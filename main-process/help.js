'use strict'
const dialog = require('electron').dialog;

const options = {
  type: 'info',
  title: 'Information',
  message: `We are using Node.js ${process.versions.node},
Chromium ${process.versions.chrome}
and Electron ${process.versions.electron}`,
  buttons: ['Ok I understand']
}

module.exports = {
  showHelpDialog() {
    dialog.showMessageBox(options, function () {
      
    })
  }
}
