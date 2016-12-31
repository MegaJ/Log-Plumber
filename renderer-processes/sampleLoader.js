const fs = require('fs');
const sample = './renderer-processes/sample-output-2.txt';

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
