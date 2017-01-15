const glob = require('glob');
const path = require('path');

var fileNames = glob.sync(path.join(__dirname, '../assets/sfx/*.wav'));
fileNames.forEach(function (fileName) {
  let soundName = path.basename(fileName).replace(/.wav/, '');
  module.exports[soundName] = soundWrapper(fileName);
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
