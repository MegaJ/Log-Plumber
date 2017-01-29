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
const regexOptionsArray = document.querySelectorAll('div[id^=regexOptions]'); // Each element is a nodelist of /gim input elements
const regexErrorsArray = document.querySelectorAll('code[id^=regexError]');
const delegator = document.querySelector('#section\\.scrape div.delegator');

//const BrowserWindow = require('electron').remote.BrowserWindow;
//const webContents = BrowserWindow.webContents;
const modal = require(__dirname + "/modal/modalFront.js");
let sounds;
require('./sounds').then((promisedSounds) => {
  sounds = promisedSounds;
});

function makeRegexRecord (regexp, regexpOpts, linkToLevel, passThru) {
  return {
    regexp: regexp,
    regexpOpts: regexOpt,
    linkToLevel: linkToLevel,
    passThru: passThru
  }
}

/** These records are hooked up to listeners that update these records
    on DOM changes to regexInput*, regexOptions*, and linker elements
    Regex Options are never displayed as a string in the UI
**/
// TODO: implement loading from stored json later
// TODO: implement passThru
// TODO: implement linking levels, meaning that you do not show a level
//       unless its k-th child also exists.
const regexpRecords = [
  {
    regexp: /(?:[\s\S](?!\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} (?:DEBUG|INFO)))+/,
    opts: "",
    link: null,
    passThru: true
  },

  {
    regexp:  /\((.*)\) *[:|-]/,
    opts: "",
    link: null,
    passThru: true
  },

  {
    regexp: / HIT: ([\s\S]*)/,
    opts: "",
    link: null,
    passThru: true
  },

  {
    regexp: /(?:SELECT|UPDATE|INSERT|DECLARE|ALTER|CREATE|DROP|GRANT)[\s\S]*/,
    opts: "",
    link: null,
    passThru: true
  }
]

function startUp () {

  rawBox.wrap = scrapeBox.wrap ="off"; // unnecessary?

  // CONSIDER: When implementing save, should have a try/catch to tell them if errors present.
  // Initialize the error displays
  let regexErrorsDisplayArray = [];
  regexErrorsArray.forEach((regexError, i) => {
    let initialTextNode = document.createTextNode('');
    regexError.appendChild(initialTextNode);
    regexErrorsDisplayArray[i] = regexError.childNodes[0];
  });

  // Fill in regexeps to display to user, order is guaranteed in ES6 for interger keys
  regexpRecords.forEach(({regexp}, i) => {
    // CONSIDER: I'll be saving regexps with their flags, so when loading them, I'll have to make sure some inputs are checked
    // Expecting matching to happen like this: [ '/a/', 'a', index: 0, input: '/a/g' ]
    regexInputsArray[i].value = regexp.toString().match(/\/(.*)\//)[1];
  });

  rawBox.addEventListener('input', (evt) => window.requestAnimationFrame(() => {
    setImmediate(asyncFilter, evt, regexpRecords, rawBox.value);
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
  
  function onRegexInputListener (evt, inputElement) {
    let regexInputIdRegexp = /regexInput([0-9]*)/;
    let match = inputElement.id.match(regexInputIdRegexp);
    if (match) {
      // TODO: stop asyncFilter with some sort of flag here
      let numSuffix = match[1];
      let currRecord = regexpRecords[numSuffix];
      let newRegexString = regexInputsArray[numSuffix].value;

      // Attempt to use the regex, which may be invalid
      try {
        let newRegexp = new RegExp(newRegexString, currRecord.opts);
        currRecord.regexp = newRegexp;
        
        // Clear the previously displayed error if regex creation was successful
        regexErrorsDisplayArray[numSuffix].nodeValue = ``;
        console.log("new regex: ", newRegexp);
        // Need a sound to play when they previously had an error and cleared it.

        // Filter the scraped output.
        window.requestAnimationFrame(() => {
          // hard code to start from the top
          setImmediate(asyncFilter, evt, regexpRecords, rawBox.value);
        });
      } catch(e) {
        sounds.error.resetPlay();
        regexErrorsDisplayArray[numSuffix].nodeValue = `Error: ${e}`;
        return;
      }
    }
  }

  function onOptionsChangeListener (evt, inputElement) {
    let regexOptionIdRegexp = /[gim]([0-9]*)/;
    let match = inputElement.id.match(regexOptionIdRegexp)
    if (match) {
      let changedCheckbox = inputElement;
      let numSuffix = match[1];
      let option = changedCheckbox.name;
      let currRecord = regexpRecords[numSuffix];
      currRecord.opts = changedCheckbox.checked ? currRecord.opts + option : currentOpts.replace(option, '');

      // CONSIDER:
      // If we update the regexpRecord to actually have the /gim flags,
      // On implementing a save, we may want to strip the regex of the flags
      // otherwise, user never gets /gim flags displayed as text, only as checked input boxes
      currRecord.regexp = new RegExp(currRecord.regexp, currRecord.opts);
      
      sounds.affirm.resetPlay();
      window.requestAnimationFrame(() => {
        // hard code to start from the top, won't have to if I implement diffing
        setImmediate(asyncFilter, evt, regexpRecords, rawBox.value);
      });
    }
  }
  delegator.addEventListener('input', delegationMakerHelper(onRegexInputListener), {capture: true, passive: true});
  delegator.addEventListener('change', delegationMakerHelper(onOptionsChangeListener), {capture: true, passive: true});

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
function asyncFilter(evt, regexpRecords, text) {
  let renderFirstBatch = true;
  let matchesPerBatch = 100;
  let doneFlag = false;

  let topLevelRegexp = regexpRecords[0].regexp;
  
  let treeView = makeTreeView();
  let orgModeView = makeOrgModeView();
  const DOMTargetParent = document.getElementById("treeView");
  const DOMTarget = DOMTargetParent.firstElementChild;

  window.requestAnimationFrame(function scrapeBoxFiller() { // TODO: need to make scrapeBoxFiller inherit from Emitter so it can listen to events
    let matchIndex = 0;
    let matches = [];
    
    if (!regexpRecords[0].regexp.global) {

      // TODO: Refactor this into a function, it is duplicated inside the for-loop below
      let matchedString = topLevelRegexp.exec(text);
      let currLevel = 1; // 0 level is the top level regex
      let currRegexp;
      for (; currLevel < regexpRecords.length; currLevel++) {
        currRegexp = regexpRecords[currLevel].regexp;
        let currMatch = matchedString[matchedString.length - 1].match(currRegexp);
        if (currMatch) {
          treeView.appendChild(currLevel, currMatch[currMatch.length - 1]);
          orgModeView.appendChild(currLevel, currMatch[currMatch.length - 1]);
        }
      }

      window.requestAnimationFrame(() => {
        scrapeBox.value = orgModeView.orgText;
        treeView.flushAttach(DOMTargetParent, DOMTarget);
      });

      return;
    }

    // Do actual regex matching to tokenize text
    for(let i = 0; i < matchesPerBatch; i++) {
      let matchedString = topLevelRegexp.exec(text);
      if (!matchedString) {
        doneFlag = true;
        break;
      }

      // currently there is no cutting the text into smaller units
      // and feeding that smaller unit to the next regex
      // the entire match is passed through,
      // TODO: maybe make this a foreach loop
      let currLevel = 1; // 0 level is the top level regex
      let currRegexp;
      for (; currLevel < regexpRecords.length; currLevel++) {
        currRegexp = regexpRecords[currLevel].regexp;
        let currMatch = matchedString[matchedString.length - 1].match(currRegexp);
        if (currMatch) {
          treeView.appendChild(currLevel, currMatch[currMatch.length - 1]);
          orgModeView.appendChild(currLevel, currMatch[currMatch.length - 1]);
        }
      }
    }

    // to give impression of responsiveness, render a small portion
    if(renderFirstBatch) {
      scrapeBox.value = orgModeView.orgText;
      renderFirstBatch = false;
    }

    if (doneFlag) {
      scrapeBox.value = orgModeView.orgText;
      treeView.flushAttach(DOMTargetParent, DOMTarget);
      return;
    }
    window.requestAnimationFrame(scrapeBoxFiller);
  });
}
