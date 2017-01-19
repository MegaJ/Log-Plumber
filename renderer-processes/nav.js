// need to have memory of this after closing app, might do a load procedure
var currentlyVisible // = loadFromStorage();

const transition = (from, to) => {
  currentlyVisible = to;
  requestAnimationFrame(() => {
    from.classList.remove(visibilityMarker);
    to.classList.add(visibilityMarker);
  })
};

if (!currentlyVisible) {
  let scrapeSection = document.getElementById("section.scrape");
  transition(scrapeSection, scrapeSection);
}

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

// I could add an accelerator for displaying nav actually...
const main = document.getElementsByTagName("main")[0];
nav.addEventListener('click', (evt) => {
  main.style.marginLeft = "0%";
  nav.style.display = "none";
});
