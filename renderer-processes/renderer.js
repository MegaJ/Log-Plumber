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

function makeRegexRecord (regexp, regexpOpts, scopeChildren) {
  return {
    regexp: regexp,
    regexpOpts: regexOpt,
    scopeChildren: scopeChildren
  }
}

/** These records are hooked up to listeners that update these records
    on DOM changes to regexInput*, regexOptions*, and linker elements
    Regex Options are never displayed as a string in the UI
**/
// TODO: make all options include the /u flag?
// TODO: implement loading from stored json later
// TODO: implement linking levels, meaning that you do not show a level
//       unless its k-th child also exists.
const regexpRecords = [
  {
    //syslogd
    //regexp: /(?:[\s\S](?![a-zA-Z]{3}\s(?:\s|\d)\d\s\d{2}:\d{2}:\d{2}\s[^\s]*\s[^\s]*:))+/,
     regexp: /(?:[\s\S](?!\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} (?:DEBUG|INFO)))+/,
    opts: "",
    scopeChildren: true
  },

  {
    regexp: / HIT: ([\s\S]*)/,
    opts: "",
    scopeChildren: false
  },

  {
    regexp:  /\((.*)\) *[:|-]/,
    opts: "",
    scopeChildren: false
  },

  {
    regexp: /(?:SELECT|UPDATE|INSERT|DECLARE|ALTER|CREATE|DROP|GRANT)[\s\S]*/,
    opts: "",
    scopeChildren: false
  }
]

// Level 2 goes to level 3
var linkLevels = {};

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
    if (inputElement.type !== "checkbox") return;
    let regexOptionIdRegexp = /[gimu]([0-9]*)/;
    let match = inputElement.id.match(regexOptionIdRegexp)
    if (match) {
      let changedCheckbox = inputElement;
      let numSuffix = match[1];
      let option = changedCheckbox.name;
      let currRecord = regexpRecords[numSuffix];
      currRecord.opts = changedCheckbox.checked ? currRecord.opts + option : currRecord.opts.replace(option, '');

      // CONSIDER:
      // If we update the regexpRecord to actually have the /gimu flags,
      // On implementing a save, we may want to strip the regex of the flags
      // otherwise, user never gets /gimu flags displayed as text, only as checked input boxes
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

  var mouseupListener = function() {

    // Find out which link nodes have been selected by the selection
    let range = window.getSelection().getRangeAt(0);
    let searchContext = document.querySelectorAll(".linker");
    if (!range.startContainer.tagName) {
      range.setStart(range.startContainer.parentElement, 0);
    }
    if (!range.endContainer.tagName) {
      range.setEnd(range.endContainer.parentElement, 0);
    }
    var linkExtent = binarySearchForLinkExtent(range, searchContext, 0, searchContext.length - 1);

    if (linkExtent) {
      linkLevels[linkExtent["left"]] = linkExtent["right"];
    }
    
    window.getSelection().removeAllRanges();
    document.addEventListener("selectionchange", textSelectionListener);
    document.removeEventListener("mouseup", mouseupListener); // event listener once option not implemented till Chrome 55
  }

  var textSelectionListener = function (event) {
    var sel = window.getSelection();
    if (sel.rangeCount > 0) {

      // If delegator contains the link text, wait for the selection to finalize on a keyup or a mouseup?
      if(delegator.contains(sel.anchorNode)) {
        document.removeEventListener("selectionchange", textSelectionListener);
        document.addEventListener("mouseup", mouseupListener, {once: true, passive: true});
      }
    }
  }
  document.addEventListener("selectionchange", textSelectionListener, {passive: true});
}

function binarySearchForLinkExtent(range, searchContext, left, right) {
  if (left > right) return null;

  var mid = Math.floor(left + (right - left) / 2); // Attempt to prevent integer overflow
  var midElement = searchContext[mid];
  var comparisonResult = range.comparePoint(midElement, 0);

  if (comparisonResult === 0) {
    // phase 2, found an item in the range
    return {
      left: binarySearchForLeftLink(range, searchContext, left, mid),
      right: binarySearchForRightLink(range, searchContext, mid, right)
    };
  } else if (comparisonResult === -1) {
    return binarySearchForLinkExtent(range, searchContext, mid + 1, right);
  } else if (comparePointResult === 1) {
    return binarySearchForLinkExtent(range, searchContext, left, mid - 1);
  }
}

function binarySearchForLeftLink(range, searchContext, left, right) {
  if (left > right) return right;
  if (left === right) return right;

  var mid = Math.floor(left + (right - left) / 2); // Attempt to prevent integer overflow
  var midElement = searchContext[mid];
  var comparisonResult = range.comparePoint(midElement, 0);

  // mid is still in the selection range
  if (comparisonResult === 0) {
    return binarySearchForLeftLink(range, searchContext, left, mid);
  } else if (comparisonResult === -1) {
    return binarySearchForLeftLink(range, searchContext, mid + 1, right);
  }

  if (comparisonResult === 1) {
    throw new Exception("binary search failure");
  }
}

function binarySearchForRightLink(range, searchContext, left, right) {
  if (left > right) return right;
  if (left === right) return right;

  var mid = Math.ceil(left + (right - left) / 2); // Attempt to prevent integer overflow
  var midElement = searchContext[mid];
  var comparisonResult = range.comparePoint(midElement, 0);

  // mid is still in the selection range
  if (comparisonResult === 0) {
    return binarySearchForRightLink(range, searchContext, mid, right);
  } else if (comparisonResult === 1) {
    return binarySearchForRightLink(range, searchContext, left, mid - 1);
  }

  if (comparisonResult === -1) {
    throw new Exception("binary search failure");
  }
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

    // Create parent if it does not exist
    var parent = rightmostPath[level - 1];
    if (!parent) {
      appendChild(level - 1, "Log Plumber Tree Level Padding");
    }
    parent = rightmostPath[level - 1];
    
    // Parents should only have checkboxes if there is more content
    // than just a label. I could do this more efficiently, by keeping
    // an array of childless parents and delete their input/ol elements
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
    
    if (!topLevelRegexp.global) { //TODO: Match behavior with global regexp branch

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

      let textScope = matchedString[matchedString.length - 1];

      // TODO: maybe make this a foreach loop
      let currLevel = 1; // 0 level is the top level regex
      let lastLevelBeforeLinkStart;
      let resultBuffer = [];
      
      let currRegexp;
      let currRecord;
      for (; currLevel < regexpRecords.length; currLevel++) {
        currRecord = regexpRecords[currLevel];
        currRegexp = currRecord.regexp;

        let beginLink = linkLevels[currLevel];
        if (beginLink) {
          lastLevelBeforeLinkStart = currLevel - 1;
        }
        
        let currMatch = textScope.match(currRegexp);
        if (currRecord.scopeChildren) {
          // If there are no matches at this level, all levels below will not match, so break;
          if (currMatch == null) {
            resultBuffer = null;
            break;
          }
          textScope = currMatch[currMatch.length - 1];
        }

        // can't put things into this view until things actually exist
        if (currMatch && !lastLevelBeforeLinkStart) {
          treeView.appendChild(currLevel, currMatch[currMatch.length - 1]);
          orgModeView.appendChild(currLevel, currMatch[currMatch.length - 1]);
        }

        // save result in a buffer
        if (currMatch && lastLevelBeforeLinkStart) {
          resultBuffer.push(currMatch[currMatch.length - 1]);
        }

        // Flush result buffer to views
        if (currLevel === linkLevels[lastLevelBeforeLinkStart + 1]) {
          if (!currMatch) {
            resultBuffer = null;
          } else {
            for (let k = 0; k < resultBuffer.length; k++) {
              treeView.appendChild(parseInt(lastLevelBeforeLinkStart) + 1 + k, resultBuffer[k]);
              orgModeView.appendChild(parseInt(lastLevelBeforeLinkStart) + 1 + k, resultBuffer[k]);
            }
          }
          
          lastLevelBeforeLinkStart = null;
          traversingInLinkedState = false;
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
