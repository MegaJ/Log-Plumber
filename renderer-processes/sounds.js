/**
   Since I cannot get node-wav and node-speaker to work together to get consistent sounds,
   and the Web Audio API is nicer, I am using the renderer process to play sounds. If the main process wants to initiate a sound, it is done through findWidgetFront.js which requires this module.
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

// I think I can get more performance if I base64 encode
// the wav files so it doesn't get decoded through an XMLHTTP request
// I might be able to use AudioContext to play files as well.
function soundWrapper(path) {
  const audio = new Audio(path);
  // because convenience is good
  audio.resetPlay = () => {
    audio.currentTime = 0;
    audio.play();
  }
  return audio;
}
