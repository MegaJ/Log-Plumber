// need to have memory of this after closing app, might do a load procedure
var currentlyVisible = currentlyVisible || document.getElementById("section.scrape");

const visibilityMarker = "is-shown";

// perform delegation to buttons, instead of adding an event listener on each button
//const sectionIds = document.querySelectorAll("section");
const sectionButtonRegex = /show-section/;
const buttonIdToSectionIdRegex = /show-/;
const nav = document.querySelector("nav");
nav.addEventListener('click', (evt) => {
  let currentElement = evt.target;

  while(currentElement && currentElement.tagName !== "BUTTON" && currentElement.type !== "NAV") {
    currentElement = currentElement.parentElement;
  }

  if (currentElement && currentElement.type === "nav") return;
  
  let targetId = currentElement.id;
  if (targetId) {
    let sectionId = targetId.match(sectionButtonRegex);
    if (sectionId) {
      transition(currentlyVisible, document.getElementById(targetId.replace(buttonIdToSectionIdRegex, "")));
    }
  } // else {
  //   throw new Error("Invalid UI, button must have an id.");
  // }
}, {capture: true, passive: true});

const transition = (from, to) => {
  currentlyVisible = to;
  requestAnimationFrame(() => {
    from.classList.remove(visibilityMarker);
    to.classList.add(visibilityMarker);
  })
};
