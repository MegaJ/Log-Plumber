const fs = require('fs');
const path = require('path');
// const sample = './renderer-processes/messages';
const sample = path.join(__dirname, 'sample-output-text');

console.log("sample path: ", sample);

const rawBox = document.getElementById("rawBox");
const rawSample = document.createTextNode('');
const readStream = fs.createReadStream(sample, 'utf-8');

readStream.on('end', (err, data) => {
  if (err) throw new Error(err);
  rawBox.appendChild(rawSample);
})

readStream.on('data', (data) => {
  rawSample.appendData(data);
});
