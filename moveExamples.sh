#!bin/bash
wd=${PWD};
rendererDir=renderer-processes;

cp $wd/$rendererDir/sampleLoader.js $wd/prepackage/$rendererDir/
cp $wd/$rendererDir/sample-output-text $wd/prepackage/$rendererDir/sample-output-2.txt
cp -r $wd/node_modules $wd/prepackage/node_modules
