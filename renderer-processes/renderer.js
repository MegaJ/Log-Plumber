// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const path = require('path');
const {clipboard, ipcRenderer, remote: {Menu}} = require('electron');

window.onload = startUp;

const copyBtn = document.getElementById('copyBtn');
const idIt = document.getElementById.bind(document);
const rAF = window.requestAnimationFrame;

const regexInput = idIt('regexInput');
const rawBox = idIt('rawBox');
const scrapeBox = idIt('scrapeBox');
const regexOptions = idIt('regexOptions');

//const BrowserWindow = require('electron').remote.BrowserWindow;
//const webContents = BrowserWindow.webContents;
const modal = require(__dirname + "/modal/modalFront.js");
let sounds;
require('./sounds').then((promisedSounds) => {
  sounds = promisedSounds;
});

function startUp () {

  rawBox.wrap = scrapeBox.wrap ="off"; // unnecessary?

  let topRegex = /([\s\S](?!\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} (DEBUG|INFO)))+/; // giyum options set by checkboxes
  let topRegexOpts = '';
  let initialTextNode = document.createTextNode('');
  idIt('regexError').appendChild(initialTextNode);
  regexErrorDisplay = idIt('regexError').childNodes[0];
  
  regexInput.value = topRegex.toString().slice(1, this.length - 1);

  // control flow is a little complicated if I have to wait until the sample is loaded
  //asyncFilter(null, topRegex);

//  let rawText = rawBox.value; // [pb] synchronous operation, slow
  rawBox.addEventListener('input', (evt) => window.requestAnimationFrame(() => {
    setImmediate(asyncFilter, evt, topRegex, rawBox.value);
  }, {passive: true}));
  
  regexInput.addEventListener('input', (evt) => {
    let newRegexString = regexInput.value;
    try {
      let newTopRegex = new RegExp(newRegexString, topRegexOpts);
      topRegex = newTopRegex;
      regexErrorDisplay.nodeValue = ``;
      console.log("new topRegex: ", topRegex);
    } catch(e) {
      regexErrorDisplay.nodeValue = `Error: ${e}`;
    }

    // let rawText = rawBox.value;  
    window.requestAnimationFrame(() => {
      setImmediate(asyncFilter, evt, topRegex, rawBox.value);
    })
  }, {passive: true});

  regexOptions.addEventListener('change', (evt) => {
    let changedCheckbox = evt.target;
    let option = changedCheckbox.name;
    topRegexOpts = changedCheckbox.checked ? topRegexOpts + option : topRegexOpts.replace(option, '');
    topRegex = new RegExp(topRegex, topRegexOpts);
    let rawText = rawBox.value; // [pb]

    sounds.affirm.resetPlay();
    window.requestAnimationFrame(() => {    
      setImmediate(asyncFilter, evt, topRegex, rawText);
    });
  }, {passive: true});

  // orthogonal
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

  function flushAttach(DOMTarget) {
    window.requestAnimationFrame(() => {
      DOMTarget.appendChild(fragment);
    });
  }

  return treeView;
}

function removeAllChildren(DOMTarget) {
  while (DOMTarget.lastChild) {
    DOMTarget.removeChild(DOMTarget.firstChild);
  }
}


/**
   Could make this function a separate module
   Batches regex matching with writing text to scrapeBox.

   This module should allow objects as arguments to specify a "mode", e.g., give output compatible to org-mode
**/
var baseURL = "http://localhost:8080/coolRoute" // mock
function asyncFilter(evt, regex, text) {
  let renderFirstBatch = true;
  let matchesPerBatch = 100;
  let doneFlag = false;
  let tempAcc = '';

  let hitRegex = / HIT: ([\s\S]*)/; //obtain first capture group
  let sqlRegex = /(?:SELECT|UPDATE|INSERT|DECLARE|ALTER|CREATE|DROP|GRANT)[\s\S]*/; // obtain 0th capture group
  let classNameAndLineNumRegex = /\((.*)\) *[:|-]/;

  let treeView = makeTreeView();
  let orgModeView = makeOrgModeView();
  const DOMTarget = document.getElementById("treeView");
  window.requestAnimationFrame(function scrapeBoxFiller() { // TODO: need to make scrapeBoxFiller inherit from Emitter so it can listen to events
    let matchIndex = 0;
    let matches = [];
    
    if (!regex.global) {
      let matchedString = text.match(regex)[0];
      let hitMatch = matchedString.match(hitRegex);
      let classNameAndLineNumMatch = classNameAndLineNumRegex.exec(matchedString);
      let sqlMatch = matchedString.match(sqlRegex);

      if (hitMatch && hitMatch[1]) {
        treeView.appendChild(1, hitMatch[1])
      }

      if (classNameAndLineNumRegex && sqlMatch) {
        treeView.appendChild(2, classNameAndLineNumMatch[0])
          .appendChild(3, sqlMatch[0]);
      }

      window.requestAnimationFrame(() => {
        scrapeBox.value = matchedString;
        removeAllChildren(DOMTarget);
        DOMTarget.appendChild(treeView.treeRoot);
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
      //scrapeBox.value = tempAcc;
      //scrapeBox.value = orgModeView.orgText;
      tempAcc = '';
      renderFirstBatch = false;
    }

    if (doneFlag) {
      //      scrapeBox.value += tempAcc;
      scrapeBox.value = orgModeView.orgText;
      removeAllChildren(DOMTarget);
      treeView.flushAttach(DOMTarget);
      return;
    }
    window.requestAnimationFrame(scrapeBoxFiller);
  });
}
