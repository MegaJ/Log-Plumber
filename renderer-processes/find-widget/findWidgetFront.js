// Renderer process
// FindWidget is the second slot in the webContents array, index it by 1
// I can do cross window search 
// TODO: display nicely the amount of matches e.g. 7/33
// TODO: position the search bar somewhere convenient

const {remote: {webContents}, remote, ipcRenderer} = require('electron');

let sounds;
require('../sounds').then((promisedSounds) => {
  sounds = promisedSounds;
});


let allWebContents = webContents.getAllWebContents();
ipcRenderer.send("findWidget-webContents-id", webContents.id);
//let mainWindowContents = allWebContents[0];
/** Should be able to tell user which match out of all matches they are on
find widget:  { requestId: 6,
  matches: 386,
  selectionArea: { x: 305, y: 268, width: 40, height: 16 },
  activeMatchOrdinal: 2,
  finalUpdate: true }
**/

window.onload = startUp;

ipcRenderer.on("reset-play-sound", (evt, soundName) => {
  sounds[soundName].resetPlay();
});

ipcRenderer.on("register-new-window", () => {
  allWebContents = webContents.getAllWebContents();
});

function startUp() {
  const findTextArea = document.getElementById("find");
  findTextArea.focus();

  let searchText = findTextArea.value;
  findTextArea.addEventListener("keydown", (evt) => {
    if (evt.keyCode === 13 && evt.shiftKey) {
      if (searchText === '') return;
      evt.preventDefault();
      allWebContents.forEach((webContent) => webContent.findInPage(searchText));
    }
  });
  
  findTextArea.addEventListener("input", (evt) => {
    allWebContents.forEach((webContent) => webContent.stopFindInPage('clearSelection'));
    searchText = findTextArea.value;
    if (searchText === '') return;
    allWebContents.forEach((webContent) => {
      webContent.findInPage(searchText);
    });
  }, {passive: true});

  findTextArea.addEventListener("blur", () => {
    findTextArea.focus();
  }, {passive: true});
}

