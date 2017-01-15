/**
   Since I cannot get node-wav and node-speaker to work together to get consistent sounds,
   and the Web Audio API is nicer, I will probably want to play sounds from the renderer process.

   So sounds.js may get end up getting its own hidden browser window to use ipc.
**/

const glob = require('glob');
const path = require('path');
const {ipcRenderer} = require('electron');

var fileNames = glob.sync(path.join(__dirname, '../assets/sfx/*.wav'));
fileNames.forEach(function (fileName) {
  let soundName = path.basename(fileName).replace(/.wav/, '');
  module.exports[soundName] = soundWrapper(fileName);
});


// ipcRenderer.on("reset-play-sound", (evt, args) => {
//   module.exports[args].resetPlay();
// });


function soundWrapper(path) {
  const audio = new Audio(path);
  // because convenience is good
  audio.resetPlay = () => {
    audio.currentTime = 0;
    audio.play();
  }
  return audio;
}
