/**
   Since I cannot get node-wav and node-speaker to work together to get consistent sounds,
   and the Web Audio API is nicer, I will probably want to play sounds from the renderer process.

   So sounds.js may get end up getting its own hidden browser window to use ipc.
**/

const glob = require('glob');
const path = require('path');
const {ipcRenderer} = require('electron');

const sounds = {};
let soundPromiseResolution;

// Asynchronous module.exports because globbing
// for file names and making sound objects synchronously
// is a little bit blocking. Allow UI to load first.
module.exports = new Promise((resolve, reject) => {
  soundPromiseResolution = resolve;
});

glob(path.join(__dirname, '../assets/sfx/*.wav'), (err, fileNames) => {
  if (err) throw err;
  
  fileNames.forEach(function (fileName) {
    let soundName = path.basename(fileName).replace(/.wav/, '');
    sounds[soundName] = soundWrapper(fileName);
  });

  soundPromiseResolution(sounds);
});

function soundWrapper(path) {
  const audio = new Audio(path);
  // because convenience is good
  audio.resetPlay = () => {
    audio.currentTime = 0;
    audio.play();
  }
  return audio;
}
