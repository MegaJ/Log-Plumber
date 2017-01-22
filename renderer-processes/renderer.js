// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const path = require('path');
const {clipboard, ipcRenderer, remote: {Menu}} = require('electron');

window.onload = startUp;


const idIt = document.getElementById.bind(document);
const rAF = window.requestAnimationFrame;

const rawBox = idIt('rawBox');
const scrapeBox = idIt('scrapeBox');
const copyBtn = document.getElementById('copyBtn');
const regexInputsArray = document.querySelectorAll('input[id^=regexInput]');
const regexOptionsArray = document.querySelectorAll('div[id^=regexOptions]');
const regexErrorsArray = document.querySelectorAll('code[id^=regexError]');
const delegator = document.querySelector('#section\\.scrape div.delegator');

//const BrowserWindow = require('electron').remote.BrowserWindow;
//const webContents = BrowserWindow.webContents;
const modal = require(__dirname + "/modal/modalFront.js");
let sounds;
require('./sounds').then((promisedSounds) => {
  sounds = promisedSounds;
});

function startUp () {

  rawBox.wrap = scrapeBox.wrap ="off"; // unnecessary?

  // regexps, regexOpts are not DOM elements, they are filled from their DOM
  // conuterparts: regexInputsArray and regexOptionsArray respectively
  // TODO: implement loading from stored json later
  let regexps = [/(?:[\s\S](?!\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} (?:DEBUG|INFO)))+/, /\((.*)\) *[:|-]/, / HIT: ([\s\S]*)/, /(?:SELECT|UPDATE|INSERT|DECLARE|ALTER|CREATE|DROP|GRANT)[\s\S]*/];
  let regexOpts = ['', '', '', ''];

  // Initialize the error displays
  let regexErrorsDisplayArray = [];
  regexErrorsArray.forEach((regexError, i) => {
    let initialTextNode = document.createTextNode('');
    regexError.appendChild(initialTextNode);
    regexErrorsDisplayArray[i] = regexError.childNodes[0];
  });

  // Fill in regexeps to display to user.
  regexps.forEach((regex, i) => {
    regexInputsArray[i].value = regexps[i].toString().slice(1, -1);
  });

  rawBox.addEventListener('input', (evt) => window.requestAnimationFrame(() => {
    setImmediate(asyncFilter, evt, regex0, rawBox.value);
  }, {passive: true}));

  function delegationMakerHelper(listenerCallback) {
    return function (evt) {
      let currentElement = evt.target;
      while(currentElement.tagName !== "INPUT" && currentElement.classList[0] !== "delegator") {
        currentElement = currentElement.parentElement;
      }

      if (currentElement.classList.contains("delegator")) return;

      listenerCallback(evt, currentElement);
    }
  }
  
  function inputListenerCallback (evt, inputElement) {
    let regexInputIdRegexp = /regexInput([0-9]*)/;
    let match = inputElement.id.match(regexInputIdRegexp);
    if (match) {
      // TODO: stop asyncFilter with some sort of flag here
      let numSuffix = match[1];
      let newRegexString = regexInputsArray[numSuffix].value;

      // Attempt to use the regex, which may be invalid
      try {
        let newRegex = new RegExp(newRegexString, regexOpts[numSuffix]);
        
        // Clear the previously displayed error if regex creation was successful
        regexErrorsDisplayArray[numSuffix].nodeValue = ``;
        console.log("new regex: ", newRegex);
        // Need a sound to play when they previously had an error and cleared it.

        // Filter the scraped output.
        window.requestAnimationFrame(() => {
          // hard code to start from the top
          setImmediate(asyncFilter, evt, newRegex, rawBox.value);
        });
      } catch(e) {
        sounds.error.resetPlay();
        regexErrorsDisplayArray[numSuffix].nodeValue = `Error: ${e}`;
        return;
      }
    }
  }

  function changeListenerCallback (evt, inputElement) {
    let regexOptionIdRegexp = /[gim]([0-9]*)/;
    let match = inputElement.id.match(regexOptionIdRegexp)
    if (match) {
      let changedCheckbox = inputElement;
      let numSuffix = match[1];
      let option = changedCheckbox.name;
      regexOpts[numSuffix] = changedCheckbox.checked ? regexOpts[numSuffix] + option : regexOpts[numSuffix].replace(option, '');
      let newRegex = new RegExp(regexps[numSuffix], regexOpts[numSuffix]);
      
      sounds.affirm.resetPlay();
      window.requestAnimationFrame(() => {
        // hard code to start from the top
        setImmediate(asyncFilter, evt, newRegex, rawBox.value);
      });
    }
  }
  delegator.addEventListener('input', delegationMakerHelper(inputListenerCallback), {capture: true, passive: true});
  delegator.addEventListener('change', delegationMakerHelper(changeListenerCallback), {capture: true, passive: true});

  copyBtn.addEventListener('click', (evt) => {
    let scrapedText = scrapeBox.value;
    clipboard.writeText(scrapedText);// [pb]
  }, {passive: true});

  initializeOtherListeners();
};

function initializeOtherListeners () {
  let newWindowBtn = document.getElementById('newWindow');

  newWindowBtn.addEventListener('click', (evt) => {
    // allow button to pop up before launching a window
    window.requestAnimationFrame(() => { 
      window.requestAnimationFrame(() => {
        ipcRenderer.send("open-new-window");
      });
    })
  }, {passive: true});
}

function makeOrgModeView() {
  let orgText = '';

  const orgModeView = {
    get orgText() { return orgText },
    appendChild: appendChild,
    flushAttach: flushAttach
  }

  function appendChild(level, textData) {
    if (level <= 0 || !level) { throw new Error(`Creating an org-mode tree view requires a positive integer level to be passed in. Got ${level}`)}
    orgText += `${"*".repeat(level)} ${textData}\n`;
    return orgModeView;
  }
  
  function flushAttach(DOMTarget) {
    window.requestAnimationFrame(() => {
      DOMTarget.appendChild(document.createTextNode(orgText));
    });
  }

  return orgModeView;
}

function makeTreeView() {
  
  const fragment = document.createDocumentFragment();
  let treeRoot = document.createElement("div");
  treeRoot.id = "treeRoot";
  // let treeRootCheckbox = document.createElement("input");
  // treeRootCheckbox.type = "checkbox";
  let treeRootOL = document.createElement("ul");
  let treeRootLI = document.createElement("li");
  treeRootLI.appendChild(document.createElement("label"));
  treeRootOL.appendChild(treeRootLI);
  //treeRoot.appendChild(treeRootCheckbox);
  treeRoot.appendChild(treeRootOL);
  fragment.appendChild(treeRoot);
  let rightmostPath = [treeRootLI];
  
  const treeView = {
    fragment: fragment,
    treeRoot: treeRoot,
    appendChild: appendChild,
    flushAttach: flushAttach
  };
  
  function appendChild(level, textData) {
    if (level <= 0 || !level) { throw new Error(`Creating a tree view requires a positive integer level to be passed in. Got ${level}`)}
    let li = document.createElement("li");
    let label = document.createElement("label");
    label.textContent = textData;
    li.appendChild(label);
    
    let parent = rightmostPath[level - 1] // || <insert some parent, so that the current li can still have a parent> ;

    // Parents should only have checkboxes if there is more content
    // than just a label. I could do this more efficiently, by keeping
    // an array of childless parents and delet their input/ol elements
    // when flushing
    if (parent.childNodes.length === 1) {
      let checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      let ol = document.createElement("ol");
      parent.appendChild(checkbox);
      parent.appendChild(ol);
    }
    parent.lastElementChild.appendChild(li);
    
    rightmostPath[level] = li;

    return treeView;
  }

  function flushAttach(DOMTargetParent, DOMTarget) {
    window.requestAnimationFrame(() => {
      DOMTargetParent.replaceChild(fragment, DOMTarget);
    });
  }

  return treeView;
}


/**
   Could make this function a separate module
   Batches regex matching with writing text to scrapeBox.

   This module should allow objects as arguments to specify a "mode", e.g., give output compatible to org-mode
**/
var baseURL = "http://localhost:8080/coolRoute" // mock
function asyncFilter(evt, regex/*Map*/, text) { // pass in a map eventually
  let renderFirstBatch = true;
  let matchesPerBatch = 100;
  let doneFlag = false;
  let tempAcc = '';

  let hitRegex = / HIT: ([\s\S]*)/; //obtain first capture group
  let classNameAndLineNumRegex = /\((.*)\) *[:|-]/;
  let sqlRegex = /(?:SELECT|UPDATE|INSERT|DECLARE|ALTER|CREATE|DROP|GRANT)[\s\S]*/; // obtain 0th capture group
  
  // use a map instead of an array for O(1) inserts/replacing regexps
  // 1-indexed because of how treeView and orgmodeViews both currently only start at level 1 because I look up parent as previous level
  // This is a target for refactoring later
  let regexMap = {1: regex, 2: hitRegex, 3: classNameAndLineNumRegex, 4: sqlRegex};
  
  let treeView = makeTreeView();
  let orgModeView = makeOrgModeView();
  const DOMTargetParent = document.getElementById("treeView");
  const DOMTarget = DOMTargetParent.firstElementChild;
  let currLevel = 1;

  // May want to recursively go to different regex levels within the regexMap
  window.requestAnimationFrame(function scrapeBoxFiller() { // TODO: need to make scrapeBoxFiller inherit from Emitter so it can listen to events
    let matchIndex = 0;
    let matches = [];
    
    if (!regexMap[currLevel].global) {

      let currText = text;
      let currMatch = ["one-time-init-value"];
      while(currMatch && currMatch[currMatch.length - 1] && regexMap[currLevel]) { 
        let currRegex = regexMap[currLevel];
        currMatch = currText.match(currRegex) || currMatch;

        if (!currMatch) break;
        // Only deepest regex level is used, if no match at deepest level, quit
        currText = currMatch[currMatch.length - 1];
        // if (currMatch && currMatch[currMatch.length - 1] !== "") {

        // }
        
        currLevel++;
      }

      treeView.appendChild(currLevel, currMatch[currMatch.length - 1]);
      orgModeView.appendChild(currLevel, currMatch[currMatch.length - 1]);

      // Refactor
      // from here
      // let matchedString = text.match(regex)[0];
      // let hitMatch = matchedString.match(hitRegex);
      // let classNameAndLineNumMatch = classNameAndLineNumRegex.exec(matchedString);
      // let sqlMatch = matchedString.match(sqlRegex);

      // if (hitMatch && hitMatch[1]) {
      //   treeView.appendChild(1, hitMatch[1])
      // }

      // if (classNameAndLineNumRegex && sqlMatch) {
      //   treeView.appendChild(2, classNameAndLineNumMatch[0])
      //     .appendChild(3, sqlMatch[0]);
      // }
      // // to here

      window.requestAnimationFrame(() => {
        scrapeBox.value = orgModeView.orgText;
        treeView.flushAttach(DOMTargetParent, DOMTarget);
      });

      return;
    }

    // Do actual regex matching to tokenize text
    for(let i = 0; i < matchesPerBatch; i++) {
      let matchedString = regex.exec(text);
      if (!matchedString) {
        doneFlag = true;
        break;
      }
      
      let output;
      let hitMatch = matchedString[0].match(hitRegex);
      if (hitMatch) {
        output = baseURL + hitMatch[1];
        treeView.appendChild(1, output);
        orgModeView.appendChild(1, output);
      }

      let classNameAndLineNumMatch = classNameAndLineNumRegex.exec(matchedString[0]);
      let sqlMatch = matchedString[0].match(sqlRegex);
      
      if(classNameAndLineNumMatch && sqlMatch) { // levels 2 & 3 are linked...hard coded for now
        matches.push(classNameAndLineNumMatch[0] + "\n");
        
        output += sqlMatch[0];
        matches.push(output);
        
        treeView.appendChild(2, classNameAndLineNumMatch[0]);
        treeView.appendChild(3, sqlMatch[0]);

        orgModeView.appendChild(2, classNameAndLineNumMatch[0]);
        orgModeView.appendChild(3, sqlMatch[0]);
      }
    }

    // accumulate the string matches
    while(matchIndex < matches.length) { // [po], could try joining entire array, or do this in forloop
      //tempAcc += matches[matchIndex];
      matchIndex++;
    }

    // to give impression of responsiveness, render a small portion
    if(renderFirstBatch) {
      scrapeBox.value = orgModeView.orgText;
      //scrapeBox.value = orgModeView.orgText;
//      tempAcc = '';
      renderFirstBatch = false;
    }

    if (doneFlag) {
      //      scrapeBox.value += tempAcc;
      scrapeBox.value = orgModeView.orgText;
      treeView.flushAttach(DOMTargetParent, DOMTarget);
      return;
    }
    window.requestAnimationFrame(scrapeBoxFiller);
  });
}
