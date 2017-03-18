#!/bin/node

const path = require('path');
const gitignorePath = path.join(__dirname, ".gitignore");

const glob = require('glob');
var gitignorePatterns = require('gitignore-to-glob')();
var str = '(';
str = gitignorePatterns[0] ? str + gitignorePatterns[0].substring(1) : str;
for(var i = 0; i < gitignorePatterns.length; i++) {
  var globPattern = gitignorePatterns[i];
  globPattern = gitignorePatterns[i] = globPattern.substring(1);
  str += "|" + globPattern.substring(1);
}
str += ")";

console.log(gitignorePatterns);
console.log(str);
var copy = require('copy');

glob('**', {ignore: gitignorePatterns}, (err, fileNames) => {
  console.log(fileNames);
  copy(fileNames, 'prepackage', (err, file) => {
    console.log(file);
  });
});

var sampleLoaderPath = "renderer-processes/sampleLoader.js"
copy(sampleLoaderPath, 'prepackage', (err, file) => {
  console.log(file);
});

// # cp -r assets $wd;
// # cp -r main-process $wd; 
// # cp -r renderer-processes $wd;
// # cp package.json $wd;
// # cp README.md $wd;
// # cp License.txt $wd;
// # cp main.js $wd;
// # cp index.html $wd;
