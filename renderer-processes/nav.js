// need to have memory of this after closing app, might do a load procedure
var currentlyVisible = currentlyVisible || document.getElementById("section.scrape");

const visibilityMarker = "is-shown";

// perform delegation to buttons, instead of adding an event listener on each button
const sectionButtonRegex = /show-(section\..*)/;
const nav = document.querySelector("nav");
nav.addEventListener('click', (evt) => {
  let currentElement = evt.target;
  
  while(currentElement.tagName !== "BUTTON" && currentElement.tagName !== "NAV") {
    currentElement = currentElement.parentElement;
  }

  if (currentElement.type === "nav") return;
  
  let targetId = currentElement.id;
  if (targetId) {
    let sectionMatch = targetId.match(sectionButtonRegex);
    let sectionId = sectionMatch[1];
    if (sectionMatch && sectionId) {
      transition(currentlyVisible, document.getElementById(sectionId));
    }
  }
}, {capture: true, passive: true});

const transition = (from, to) => {
  currentlyVisible = to;
  requestAnimationFrame(() => {
    from.classList.remove(visibilityMarker);
    to.classList.add(visibilityMarker);
  })
};
