// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const path = require('path');
const {clipboard, ipcRenderer, remote: {Menu}} = require('electron');

window.onload = startUp;

const idIt = document.getElementById.bind(document);

const rawBox = idIt('rawBox');
const scrapeBox = idIt('scrapeBox');
const copyBtn = document.getElementById('copyBtn');
const regexInputsArray = nodelistToArray(document.querySelectorAll('input[id^=regexInput]'));
const regexErrorsArray = nodelistToArray(document.querySelectorAll('code[id^=regexError]'));
const regexErrorsDisplayArray = [];
const delegator = document.querySelector('#level-delegator');
const linkSpans = nodelistToArray(document.querySelectorAll('.linker'));
const linkLevels = new Map();

// Generators are kind of like promises. They might be isomorphic.
var produceFreshInt = idMaker();
function* idMaker(initVal) {
  var index = initVal;
  if (!index) return;
  while (true) {
    yield index++;
  }
}

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
    regexpOpts: regexpOpts,
    scopeChildren: scopeChildren
  }
}

// Could also modify the innerHTML for more speed instead of using DOMParser
function makeDOMRegexp (number) {
  const parser = new DOMParser();
  const DOMRegexpTemplate =
  `<div class="flex-container">
            <span class="dejaVuBold removeRegex pointer">▬</span>
            
            <div id="regexOptions2" class="flex-containee-small dejaVuBold left-margin">
              <input id="scopeChildren2" name="scopeChildren2" type="checkbox" class="hide-checkbox scopeChildren"><label for="scopeChildren2">
                <span class="scopeChildren">🔬</span>
              </label>
              <span class="linker">⛓</span>
              <input id="g2" name="g" type="checkbox" class="regexOption"><label for="g2" class="g">◉</label>
              <input id="i2" name="i" type="checkbox" class="regexOption"><label for="i2" class="i">◉</label>
              <input id="m2" name="m" type="checkbox" class="regexOption"><label for="m2" class="m">◉</label>
            </div>
            <input id="regexInput2" class="regexInput flex-containee-large left-margin" placeholder="type a regular expression">
    </div>
    <code id="regexError2"></code>`

  const DOMRegexp = DOMRegexpTemplate.replace(/2/g, number);
  const templateFragment = document.createDocumentFragment();
  const htmlBody = parser.parseFromString(DOMRegexp, 'text/html').body;

  while (htmlBody.hasChildNodes()) templateFragment.appendChild(htmlBody.firstChild);
  return templateFragment;
}

/** These records are hooked up to listeners that update these records
    on DOM changes to regexInput*, regexOptions*, and linker elements
    Regex Options are never displayed as a string in the UI
**/

// TODO: implement loading from stored json later
const regexpRecords = [
  {
    //syslogd
    //regexp: /(?:[\s\S](?![a-zA-Z]{3}\s(?:\s|\d)\d\s\d{2}:\d{2}:\d{2}\s[^\s]*\s[^\s]*:))+/,
     regexp: /(?:[\s\S](?!\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} (?:DEBUG|INFO)))+/,
    regexpOpts: "u",
    scopeChildren: true
  },

  {
    regexp: / HIT: ([\s\S]*)/,
    regexpOpts: "u",
    scopeChildren: false
  },

  {
    regexp:  /\((.*)\) *[:|-]/,
    regexpOpts: "u",
    scopeChildren: false
  },

  {
    regexp: /(?:SELECT|UPDATE|INSERT|DECLARE|ALTER|CREATE|DROP|GRANT)[\s\S]*/,
    regexpOpts: "u",
    scopeChildren: false
  }
]

function startUp () {

  rawBox.wrap = scrapeBox.wrap ="off"; // unnecessary?

  // CONSIDER: When implementing save, should have a try/catch to tell them if errors present.
  // Initialize the error displays
  // regexErrorsDisplayArray = [];
  regexErrorsArray.forEach((regexError, i) => {
    let initialTextNode = document.createTextNode('');
    regexError.appendChild(initialTextNode);
    regexErrorsDisplayArray[i] = regexError.childNodes[0];
  });

  produceFreshInt = (function() {
    var gen = idMaker(regexpRecords.length);
    idMaker = null;
    return function() {
      return gen.next().value
    }
  })();

  // Fill in regexeps to display to user, order is guaranteed in ES6 for interger keys
  regexpRecords.forEach(({regexp}, i) => {
    // Expecting matching to happen like this: [ '/a/', 'a', index: 0, input: '/a/g' ]
    regexInputsArray[i].value = regexp.toString().match(/\/(.*)\//)[1];
  });

  // TODO: Group together the functionality that calls asyncFilter real-time, so it can be triggered by the lightning button
  rawBox.addEventListener('input', (evt) => window.requestAnimationFrame(() => {
    setImmediate(asyncFilter, evt, regexpRecords, rawBox.value);
  }, {passive: true}));

  function delegationMakerHelper(listenerCallback) {
    const validTargets = {"INPUT": true, "SPAN": true}
    return function (evt) {
      let currentElement = evt.target;
      while(!(currentElement.tagName in validTargets) && currentElement.classList[0] !== "delegator") {
        currentElement = currentElement.parentElement;
      }

      if (currentElement.classList.contains("delegator")) return;

      listenerCallback(evt, currentElement);
    }
  }
  
  function onRegexInputListener (evt, inputElement) {
    let regexInputIdRegexp = /regexInput([0-9]+)/;
    let match = inputElement.id.match(regexInputIdRegexp);
    if (match) {
      // TODO: stop asyncFilter with some sort of flag here

      
      
      let numSuffix = match[1];
      let numSuffixPosition = idPositionMap.get(parseInt(numSuffix));
      let currRecord = regexpRecords[numSuffixPosition];
      let newRegexString = regexInputsArray[numSuffixPosition].value;

      // Attempt to use the regex, which may be invalid
      try {
        let newRegexp = new RegExp(newRegexString, currRecord.regexpOpts);
        currRecord.regexp = newRegexp;
        
        // Clear the previously displayed error if regex creation was successful
        regexErrorsArray[numSuffixPosition].textContent = ``;
        console.log("new regex: ", newRegexp);
        // Need a sound to play when they previously had an error and cleared it.

        // Filter the scraped output.
        window.requestAnimationFrame(() => {
          // hard code to start from the top
          setImmediate(asyncFilter, evt, regexpRecords, rawBox.value);
        });
      } catch(e) {
        sounds.error.resetPlay();
        regexErrorsArray[numSuffixPosition].textContent = `Error: ${e}`;
        return;
      }
    }
  }

  // TODO: refactor this
  function onOptionsChangeListener (evt, inputElement) {
    if (inputElement.type !== "checkbox") return;

    let scopeChildrenRegexp = /scopeChildren([0-9]+)/;
    let match = inputElement.id.match(scopeChildrenRegexp);
    if (match) {
      let changedCheckbox = inputElement;
      let numSuffix = parseInt(match[1]);
      let position = idPositionMap.get(numSuffix);
      let currRecord = regexpRecords[position];
      currRecord.scopeChildren = changedCheckbox.checked ? true : false;
      return;
    }

    let regexOptionIdRegexp = /[gimu]([0-9]+)/;
    match = inputElement.id.match(regexOptionIdRegexp)
    if (match) {
      let changedCheckbox = inputElement;
      let numSuffix = parseInt(match[1]);
      let position = idPositionMap.get(numSuffix);
      let option = changedCheckbox.name;
      let currRecord = regexpRecords[position];
      currRecord.regexpOpts = changedCheckbox.checked ? currRecord.regexpOpts + option : currRecord.regexpOpts.replace(option, '');

      // CONSIDER:
      // If we update the regexpRecord to actually have the /gimu flags,
      // On implementing a save, we may want to strip the regex of the flags
      // otherwise, user never gets /gimu flags displayed as text, only as checked input boxes
      currRecord.regexp = new RegExp(currRecord.regexp, currRecord.regexpOpts);
      
      sounds.affirm.resetPlay();
      window.requestAnimationFrame(() => {
        // hard code to start from the top, won't have to if I implement diffing
        setImmediate(asyncFilter, evt, regexpRecords, rawBox.value);
      });
    } 
  }
  
  delegator.addEventListener('input', delegationMakerHelper(onRegexInputListener), {capture: true, passive: true});
  delegator.addEventListener('change', delegationMakerHelper(onOptionsChangeListener), {capture: true, passive: true});
  delegator.addEventListener('keydown', delegationMakerHelper(regexpRecordSwap));
  delegator.addEventListener('keypress', delegationMakerHelper(regexpRecordSwap));

  delegator.addEventListener('click', delegationMakerHelper(removeRegexp));

  function removeRegexp(clickEvent) {
    let span = clickEvent.target;
    if (span.tagName !== "SPAN" || !span.classList.contains("removeRegex")) return false;

    let regexpTarget = span.closest("div.flex-container");
    let parent = regexpTarget.parentElement;
    parent.removeChild(regexpTarget.nextElementSibling); // only works if nextElementSibling is guaranteed to be a <code> element
    parent.removeChild(regexpTarget);
    

    let numSuffix = parseInt(regexpTarget.querySelector("div[id^=regexOptions]").id.match(/[0-9]+/)[0]);

    let position = idPositionMap.get(numSuffix);
    idPositionMap.delete(numSuffix);
    decrementMapValues(idPositionMap, position); //TODO: testttt!

    //positionIDMap.delete(position);
    produceMapReverse(idPositionMap, positionIDMap);

    regexpRecords.splice(position, 1);
    regexInputsArray.splice(position, 1);
    linkSpans.splice(position, 1);
    regexErrorsArray.splice(position, 1);

    unhighlightLinkExtent(0, linkSpans.length - 1);
    // link levels needs to be updated as well...for now just wipe it out
    linkLevels.clear()
    
    // have to update global stuff
    // use self-balancing trees. But right now, just splice.
  }

  document.querySelector("#newRegex").addEventListener('click', addRegexp, {passive: true});
  function addRegexp(clickEvent) {
    const regexpIndex = produceFreshInt();
    const newDOMRegexp = makeDOMRegexp(regexpIndex);
    window.requestAnimationFrame(() => {
      const newPosition = regexpRecords.length;
      regexpRecords[newPosition] = makeRegexRecord(/(?:)/, "u", false);
      // TODO: I think this can be refactored into a query selector destructurin
      positionIDMap.set(newPosition, regexpIndex);
      idPositionMap.set(regexpIndex, newPosition);
      
      regexInputsArray[newPosition] = newDOMRegexp.querySelector(`#regexInput${regexpIndex}`);
      linkSpans[newPosition] = newDOMRegexp.querySelector('.linker');
      regexErrorsArray[newPosition] = newDOMRegexp.querySelector("code[id^=regexError");
      //regexOptionsArray[regexOptionsArray.length] = newDOMRegexp.querySelectorAll('div[id^=regexOptions]');

      document.querySelector("#level-delegator").appendChild(newDOMRegexp);
    });
  }

  document.querySelector("#execute").addEventListener("click", (clickEvent) => {
    const runButton = clickEvent.target;
    window.requestAnimationFrame(() => {
      setImmediate(asyncFilter, runButton, regexpRecords, rawBox.value);
    });
  }, {passive: true});

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
    let selection = window.getSelection();
    let range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (!range) return;
    
    let searchContext = linkSpans;
    let ancestorSelector = "div.flex-container";
    if (!range.startContainer.tagName) {
      range.setStart(range.startContainer.parentElement.closest(ancestorSelector), 0);
    }
    if (!range.endContainer.tagName) {
      range.setEnd(range.endContainer.parentElement.closest(ancestorSelector), 0);
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


// TODO: Need to make sure the linkLevels UI indications remain with their original levels.
function regexpRecordSwap(keyDownOrPressEvent) {
  if (!keyDownOrPressEvent.altKey) return false;
  if (keyDownOrPressEvent.keyCode !== 38 && keyDownOrPressEvent.keyCode !== 40) return false;
  
  var regexpRecordInput = keyDownOrPressEvent.target;
  var regexpRecordContainer = regexpRecordInput.closest("div.flex-container");

  let sibling = null;
  let filter = (element) => {
    return element.tagName === "DIV" && element.classList.contains("flex-container");
  };

  let [ , stringID] = regexpRecordInput.id.match(/regexInput([0-9]+)/);
  let thisID = parseInt(stringID);
  let thisPosition = idPositionMap.get(thisID);
  let otherID = null;
  let otherPosition = null;
  
  // Up
  if (keyDownOrPressEvent.keyCode === 38) {
    sibling = findSibling(regexpRecordContainer, filter, false);
    otherID = positionIDMap.get(thisPosition - 1);
  }

  // Down
  if (keyDownOrPressEvent.keyCode === 40) {
    sibling = findSibling(regexpRecordContainer, filter, true);
    otherID = positionIDMap.get(thisPosition + 1);
  }

  window.requestAnimationFrame(() => {
    if (sibling !== null) {
      otherPosition = idPositionMap.get(otherID);


      swapElements(sibling, regexpRecordContainer);
      mapSwap(positionIDMap, thisPosition, otherPosition);
      mapSwap(idPositionMap, thisID, otherID);
      swap(regexpRecords, thisPosition, otherPosition);
      /** regexErrorsArray doesn't need to swap because I swap the text nodes within them**/
      //swap(regexErrorsArray, thisPosition, otherPosition);
      //text swap:
      let thisErrorText = regexErrorsArray[thisPosition].textContent;
      regexErrorsArray[thisPosition].textContent = regexErrorsArray[otherPosition].textContent;
      regexErrorsArray[otherPosition].textContent = thisErrorText;
      
      // linkSpans should swap since we access them positionally with a fromLevel to a toLevel.
      swap(linkSpans, thisPosition, otherPosition);
      swap(regexInputsArray, thisPosition, otherPosition);
      
    }

    regexpRecordInput.focus();
  });
}



function findSibling(element, filter, forward = true) {
  var method = forward ? "nextElementSibling" : "previousElementSibling";
  var currElement = element[method];
  while(currElement !== null) {
    if (!filter || filter(currElement)) {
      break;
    }
    currElement = currElement[method];
  }
  
  return currElement;
}

const idPositionMap = new Map();
const positionIDMap = new Map();
for(let i = 0; i < regexpRecords.length; i++) {
  idPositionMap.set(i, i);
  positionIDMap.set(i, i);
}


// http://stackoverflow.com/questions/3199588/fastest-way-to-convert-javascript-nodelist-to-array
function nodelistToArray(nodelist) {
  var arr = [];
  for (var i = 0, ref = arr.length = nodelist.length; i < ref; i++) {
    arr[i] = nodelist[i];
  }
  return arr;
}

function swap(collection, keyA, keyB) {
  var a = collection[keyA];
  collection[keyA] = collection[keyB];
  collection[keyB] = a;
  //    [collection[keyA], collection[keyB]] = [collection[keyB], collection[keyA]];
  return collection;
}

function mapSwap(map, keyA, keyB) {
  var tempA = map.get(keyA);
  map.set(keyA, map.get(keyB));
  map.set(keyB, tempA);
}

function decrementMapValues (aMap, pastThis) {
  for (var [key, value] of aMap) {

    if (value > pastThis) {
      aMap.set(key, value - 1);
    }
  }

  return aMap;
}

function produceMapReverse(aMap, bMap) {
  var bMap = bMap || new Map();
  bMap.clear();
  for (var [key, value] of aMap) {
    bMap.set(value, key);
  }

  return bMap;
}


// http://stackoverflow.com/questions/10716986/swap-2-html-elements-and-preserve-event-listeners-on-them
function swapElements(obj1, obj2) {
  // save the location of obj2
  var parent2 = obj2.parentNode;
  var next2 = obj2.nextSibling;
  // special case for obj1 is the next sibling of obj2
  if (next2 === obj1) {
    // just put obj1 before obj2
    parent2.insertBefore(obj1, obj2);
  } else {
    // insert obj2 right before obj1
    obj1.parentNode.insertBefore(obj2, obj1);

    // now insert obj1 where obj2 was
    if (next2) {
      // if there was an element after obj2, then insert obj1 right before that
      parent2.insertBefore(obj1, next2);
    } else {
      // otherwise, just append as last child
      parent2.appendChild(obj1);
    }
  }
}

// CONSIDER: range.comparePoint will incorrectly return 1
// even when the element in question is a child of range.endContainer
// There is no documentation I could find of the endContainer being exclusive, not inclusive
function binarySearchForLinkExtent(range, searchContext, left, right) {
  if (left > right) return null;

  var mid = Math.floor(left + (right - left) / 2); // Attempt to prevent integer overflow
  var midElement = searchContext[mid];
  var comparisonResult = range.comparePoint(midElement, 0);
  if (comparisonResult === 1) {
    comparisonResult = range.endContainer.contains(midElement) ? 0 : comparisonResult;
  }

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
  if (comparisonResult === 1) {
    comparisonResult = range.endContainer.contains(midElement) ? 0 : comparisonResult;
  }

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
  if (comparisonResult === 1) {
    comparisonResult = range.endContainer.contains(midElement) ? 0 : comparisonResult;
  }

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

// This is called to clear highlights across all levels when removing a regexp, hence different indexing
function unhighlightLinkExtent(fromLevel, toLevel) {
  const parentSelector = "div.flex-container";
  
  for(var i = fromLevel; i <= toLevel; i++) {
    let targetDiv = linkSpans[i].closest(parentSelector);
    targetDiv.classList.remove("vertical-merge");
    targetDiv.style["background"] = null;
  }
}

// function unhighlightLinkLevels(fromLevel) {
//   const parentSelector = "div.flex-container";
//   const stopLevel = linkLevels.get(fromLevel);
//   for (var i = fromLevel; i <= stopLevel; i++) {
//     let targetDiv = linkSpans[i].closest(parentSelector);
//     targetDiv.classList.remove("vertical-merge");
//     targetDiv.style["background"] = null;
//   }
// }

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
function asyncFilter(evt, regexpRecords, text, modes) {
  let renderFirstBatch = true;
  let matchesPerBatch = 100;
  let doneFlag = false;

  let topLevelRegexp = regexpRecords[0].regexp;

  // TODO: can make the view objects singletons, add them to global scope
  // TODO: Add methods to clear the view objects
  let treeView = makeTreeView();
  let orgModeView = makeOrgModeView();

  // TODO: set selectors inside each view object so I don't have to expose these references...
  const DOMTargetParent = document.getElementById("treeView");
  const DOMTarget = DOMTargetParent.firstElementChild;

  let resultBuffer = [];
  let resultBufferIndex = null;
  let textProcess = new TextProcess();

  // TODO: need to make scrapeBoxFiller inherit from Emitter so it can listen to events
  window.requestAnimationFrame(scrapeBoxFiller);

  function scrapeBoxFiller() {
    let matchIndex = 0;
    let matches = [];

    /** 
        This is not worth refactoring into the for loop below because of 
        how a regular expression's .lastIndex property doesn't increment
        when the regexp isn't global. I can manually set it, but that feels wrong.
     **/
    if (!topLevelRegexp.global) {
      let programStack = [];
      initializeProgramStack(programStack, topLevelRegexp, text)
      textProcess.run(programStack, resultBuffer, orgModeView, treeView);
      window.requestAnimationFrame(() => {
        scrapeBox.value = orgModeView.orgText;
        treeView.flushAttach(DOMTargetParent, DOMTarget);
      });

      return;
    }
    
    // Do actual regex matching to tokenize text
    for(let i = 0; i < matchesPerBatch; i++) {
      let programStack = [];
      let matchedString = initializeProgramStack(programStack, topLevelRegexp, text);
      if (!matchedString) {
        doneFlag = true;
        break;
      }

      textProcess.run(programStack, resultBuffer, orgModeView, treeView);
    }

    // To give impression of responsiveness, render a small portion
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
  }
}

/**
   Note the additional side effect of moving topLevelRegexp.lastIndex every time this functino is called,
   when topLevelRegexp is global.
**/
function initializeProgramStack(programStack, topLevelRegexp, text) {
  let matchedString = topLevelRegexp.exec(text);
  if (!matchedString) return matchedString;
  
  let textScope = matchedString[matchedString.length - 1]; // matchedString might be null

  let nextLevel = 1; // check if the next level even exists
  let currentLinkageStartLevel;
  let beginLink = linkLevels.get(0);
  if (beginLink) {
    currentLinkageStartLevel = 0;
  }
  
  let programState = {
    currLevel: nextLevel,
    textScope: textScope,
    currentLinkageStartLevel: currentLinkageStartLevel
  }
  programStack[0] = programState;

  
  return matchedString;
}

function TextProcess() {
  this.resultBufferIndex = null;
}

TextProcess.prototype.run = function (programStack, resultBuffer, orgModeView, treeView) {    
  while(programStack.length) {
    let programState = programStack[programStack.length - 1];
    let currLevel = programState.currLevel;
    let textScope = programState.textScope;
    let currentLinkageStartLevel = programState.currentLinkageStartLevel;
    let endLevel = linkLevels.get(currentLinkageStartLevel);
    if (currLevel > endLevel) {
      currentLinkageStartLevel = null;
    }

    let currRecord = regexpRecords[currLevel];
    let currRegexp = currRecord.regexp;
    
    let beginLink = linkLevels.get(currLevel);
    if (beginLink) {
      currentLinkageStartLevel = currLevel;
    }   

    let recurseDown = false;
    let currMatch;
    if (currRegexp.global) {
      currMatch = currRegexp.exec(textScope);
      if (currMatch) {
        textScope = currMatch[currMatch.length - 1];
        recurseDown = true;
      }
    } else {
      currMatch = textScope.match(currRegexp);
    }

    let nextLevel = currLevel + 1;
    let nextStackInstance = {
      currLevel: nextLevel,
      textScope: textScope,
      currentLinkageStartLevel: currentLinkageStartLevel
    };
    if (nextLevel < regexpRecords.length && recurseDown) {
      programStack[programStack.length] = nextStackInstance;
    }
    if (recurseDown) {continue;} // global regexps can't pop yet, because they get revisited for successive matches due to the /g flag

    // Commit the pop only when we are ready to add something to views or resultBuffer
    programStack.length = programStack.length - 1;

    // If /g, then there is an automatic scope. All its matches are processed by regexps down the tree
    // So there will be no match for the rest of the while loop
    if (currRecord.scopeChildren) {
      if (currMatch == null) {
        // If there are no matches at this level, all levels below will not match so go to level above
        continue;
      }
      textScope = currMatch[currMatch.length - 1];
      nextStackInstance.textScope = textScope;
    }

    if (nextLevel < regexpRecords.length) {
      programStack[programStack.length] = nextStackInstance;
    }


    if (currMatch) {
      // Clear buffer if we are branching the tree from another parent
      // There is another parent if currLevel is ancestor of level where linking starts
      if (Number.isInteger(currentLinkageStartLevel) && currLevel <= currentLinkageStartLevel) {
        resultBuffer.length = 0; // This was a subtle bug. I clear the resultBuffer while keeping the original reference.
        this.resultBufferIndex = null;
      }
      
      /** Views are only safe to save to if linkage constraints are satisfied. 
          Otherwise, wait for linkage to be resolved at the endLevel.
      **/
      if (!Number.isInteger(currentLinkageStartLevel)) {
        treeView.appendChild(currLevel, currMatch[currMatch.length - 1]);
        orgModeView.appendChild(currLevel, currMatch[currMatch.length - 1]);
        
      } else {
        let currOffset = currLevel - currentLinkageStartLevel;
        resultBuffer[currOffset] = currMatch[currMatch.length - 1];

        if (this.resultBufferIndex === null) {
          this.resultBufferIndex = currOffset;
        }

        if (this.resultBufferIndex > 0) {
          this.resultBufferIndex = this.resultBufferIndex > currOffset ? currOffset : this.resultBufferIndex;
        }
      }
    }

    // Loop through only a continguous subportion of the resultBuffer.
    // Flush result buffer to views if the level ending the link has a match before resultBuffer is cleared
    if (currLevel === endLevel) {
      let shouldFlush = currMatch && Number.isInteger(this.resultBufferIndex);
      if (shouldFlush) {
        // TODO: I never figured out why this.resultBufferIndex + linkLength can exceed resultBuffer.length, but for the time being, this Math.min seems to work 
        let linkLength = endLevel - currentLinkageStartLevel + 1;
        let runLength = Math.min(resultBuffer.length, linkLength);
        for (let k = this.resultBufferIndex; k < runLength; k++) {
          treeView.appendChild(parseInt(currentLinkageStartLevel) + k, resultBuffer[k]);
          orgModeView.appendChild(parseInt(currentLinkageStartLevel) + k, resultBuffer[k]);
        }

        this.resultBufferIndex = null;
      }
    }
  }
}
