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
const delegator = document.querySelector('#level-delegator');
const linkSpans = document.querySelectorAll('.linker'); 

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
    opts: "u",
    scopeChildren: true
  },

  {
    regexp: / HIT: ([\s\S]*)/,
    opts: "u",
    scopeChildren: false
  },

  {
    regexp:  /\((.*)\) *[:|-]/,
    opts: "u",
    scopeChildren: false
  },

  {
    regexp: /(?:SELECT|UPDATE|INSERT|DECLARE|ALTER|CREATE|DROP|GRANT)[\s\S]*/,
    opts: "u",
    scopeChildren: false
  }
]

// Level 2 goes to level 3
var linkLevels = new Map();

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

  // TODO: refactor this
  function onOptionsChangeListener (evt, inputElement) {
    if (inputElement.type !== "checkbox") return;

    let scopeChildrenRegexp = /scopeChildren([0-9])*/;
    let match = inputElement.id.match(scopeChildrenRegexp);
    if (match) {
      let changedCheckbox = inputElement;
      let numSuffix = match[1];
      let currRecord = regexpRecords[numSuffix];
      currRecord.scopeChildren = changedCheckbox.checked ? true : false;
      return;
    }

    let regexOptionIdRegexp = /[gimu]([0-9]*)/;
    match = inputElement.id.match(regexOptionIdRegexp)
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

  var mouseupListener = function(event) {

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
      let fromLevel = linkExtent["left"]; let toLevel = linkExtent["right"];

      requestAnimationFrame(function () {
        // remove ranges when we actually selected over linker spans
        window.getSelection().removeAllRanges();
        
        if (linkLevels.has(fromLevel) && linkLevels.get(fromLevel) === toLevel) {
          unhighlightLinkExtent(fromLevel, toLevel);
          linkLevels.delete(fromLevel);
          return;
        }
      
        linkLevels.set(fromLevel, toLevel);
        highlightLinkExtent(fromLevel, toLevel)
      });
    }
    
    document.addEventListener("selectionchange", textSelectionListener);
    document.removeEventListener("mouseup", mouseupListener, {once: true, passive: true}); // event listener once option not implemented till Chrome 55
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
  } else if (comparisonResult === 1) {
    return binarySearchForLinkExtent(range, searchContext, left, mid - 1);
  }
}

function binarySearchForLeftLink(range, searchContext, left, right) {
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
    throw new Error("binary search failure");
  }
}

function binarySearchForRightLink(range, searchContext, left, right) {
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
    throw new Error("binary search failure");
  }
}

function highlightLinkExtent(fromLevel, toLevel) {
  const parentSelector = "div.flex-container";
  const colorStringForLinkage = getRandomColor();
  // top one shouldn't have verticl merge
  linkSpans[fromLevel].closest(parentSelector).style["background"] = colorStringForLinkage;
  for(var i = fromLevel + 1; i <= toLevel; i++) {
    let targetDiv = linkSpans[i].closest(parentSelector);
    targetDiv.classList.add("vertical-merge");
    targetDiv.style["background"] = colorStringForLinkage;
  }
}

function unhighlightLinkExtent(fromLevel, toLevel) {
  const parentSelector = "div.flex-container";
  
  linkSpans[fromLevel].closest(parentSelector).style["background"] = null;
  for(var i = fromLevel + 1; i <= toLevel; i++) {
    let targetDiv = linkSpans[i].closest(parentSelector);
    targetDiv.classList.remove("vertical-merge");
    targetDiv.style["background"] = null;
  }
}

/** 
    http://stackoverflow.com/questions/1535128/apply-random-color-to-class-elements-individually
**/
function getRandomColor(opacity = 0.8) {
  var hue = 'rgba(' +
      (Math.floor((256-199)*Math.random()) + 200) + ',' +
      (Math.floor((256-199)*Math.random()) + 200) + ',' +
      (Math.floor((256-199)*Math.random()) + 200) + ',' +
      opacity + ')';
  return hue;
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

      var windowBtn = document.querySelector("#newWindow");
      toggleDisableOnButton(windowBtn, true);
    });
  }

  return treeView;
}

function toggleDisableOnButton(selection, flag) {
  var newWindowBtn = typeof selection === "string" ? document.querySelector(selection) : selection;
  
  if (!(newWindowBtn instanceof Node)) {
    throw new Error("First argument must be a selector or a Node object.");
  }

  if (flag === undefined) {
    newWindowBtn.disabled = newWindowBtn.disabled ? false : true;
    return;
  } 

  newWindowBtn.disabled = !flag;
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

  // For link levels feature
  let resultBuffer = [];
  let resultBufferIndex = null;

  /** TODO: Have to save state between scrapeBoxFiller calls,
      I can do that here so the variables will be within closure
   **/
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

      let currLevel = 1; // 0 level is the top level regex

      let lastLevelBeforeLinkStart;

      // TODO: This loop is now more complex than I am comfortable with.
      // [RC]
      let currRegexp;
      let currRecord;
      for (; currLevel < regexpRecords.length; currLevel++) {        
        currRecord = regexpRecords[currLevel];
        currRegexp = currRecord.regexp;
        
        let currMatch = textScope.match(currRegexp);
        if (currRecord.scopeChildren) {
          // If there are no matches at this level, all levels below will not match, so break;
          if (currMatch == null) {
            break;
          }
          textScope = currMatch[currMatch.length - 1];
        }

        let beginLink = linkLevels.get(currLevel);
        if (beginLink) {
          lastLevelBeforeLinkStart = currLevel - 1;
        }

        // Clear buffer if we are branching the tree from another parent
        // There is another parent if currLevel is ancestor of level where linking starts
        if (currMatch && Number.isInteger(lastLevelBeforeLinkStart) && currLevel <= lastLevelBeforeLinkStart) {
          resultBuffer = [];
          resultBufferIndex = null;
        }

        // can't put things into this view until things actually exist
        if (currMatch && !Number.isInteger(lastLevelBeforeLinkStart)) {
          treeView.appendChild(currLevel, currMatch[currMatch.length - 1]);
          orgModeView.appendChild(currLevel, currMatch[currMatch.length - 1]);
        }

        if (currMatch && Number.isInteger(lastLevelBeforeLinkStart)) {
          let currOffset = currLevel - (lastLevelBeforeLinkStart + 1);
          resultBuffer[currOffset] = currMatch[currMatch.length - 1];

          if (resultBufferIndex === null) {
            resultBufferIndex = currOffset;
          }

          if (resultBufferIndex > 0) {
            resultBufferIndex = resultBufferIndex > currOffset ? currOffset : resultBufferIndex;
          }
        }


        let endLevel = linkLevels.get(lastLevelBeforeLinkStart + 1);
        // Loop through only a continguous subportion of the resultBuffer.
        // Flush result buffer to views if the level ending the link has a match before resultBuffer is cleared
        if (currLevel === endLevel) {
          let shouldFlush = currMatch && Number.isInteger(resultBufferIndex);
          if (shouldFlush) {
            // TODO: I never figured out why resultBufferIndex + linkLength can exceed resultBuffer.length, but for the time being, this Math.min seems to work 
            let linkLength = endLevel - lastLevelBeforeLinkStart;
            let runLength = Math.min(resultBuffer.length, linkLength);
            for (let k = resultBufferIndex; k < runLength; k++) {
              treeView.appendChild(parseInt(lastLevelBeforeLinkStart) + 1 + k, resultBuffer[k]);
              orgModeView.appendChild(parseInt(lastLevelBeforeLinkStart) + 1 + k, resultBuffer[k]);
            }

            resultBufferIndex = null;
          }
          
          lastLevelBeforeLinkStart = null;
          traversingInLinkedState = false; // TODO: use this instead of lastLevelBeforeLinkStart
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
