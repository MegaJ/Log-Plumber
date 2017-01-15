/** Required by main process through mainMenuTemplate.js

How to make toggle available for search across all windows?

Stick to the active window context for now.
**/
const path = require('path');
const {BrowserWindow, Menu, webContents, ipcMain} = require('electron');
const mainWindowWebContents = webContents.getAllWebContents()[0];
//const sounds = require('../renderer-processes/sounds');
//const mainWindow = require('./main');
//console.log("main window: ", mainWindow);
let win = new BrowserWindow({width: 220,
                             minWidth: 220,
                             minHeight: 50,
                             height: 50,
                             frame: true,
                             parent: null, // using the mainWindow as a parent, but not really sure if that's beneficial
                             show: false,
                             alwaysOnTop: true, // fails in linux at least
                             //resizable: false,
                             //useContentSize: true,
                             fullScreenable: false,
                             textAreasAreResizable: false, // doesn't work
                             titleBarStyle: "hidden"
                            });

const template = [
  {
    label: 'Toggle',
    role: 'find',
    accelerator: "CmdOrCtrl+f",
    click() {
      //console.log("from within the find widget!");
      toggle();
    }
  }
];
const menu = Menu.buildFromTemplate(template);
win.setMenu(menu);

let findWidgetUrl = path.join("file://", __dirname, "../", "renderer-processes", "find-widget", "findWidget.html");
win.loadURL(findWidgetUrl);
//win.openDevTools();
            
let visible = false;
const findWidgetWebContents = win.webContents;

function toggle() {
  visible = !visible;
  if (visible) {
    win.show();
    win.focus(); // async
  } else {
    win.hide();
  }
}

let killFindWidget = false;

(function setupListeners() {

  win.on('close', (evt) => {
    if (!killFindWidget) {
      evt.preventDefault();
      win.hide();
    }
  });
  
  win.on('closed', () => {
    win = null
  });

  mainWindowWebContents.on('found-in-page', (evt, result) => {
    console.log("find widget: ", result);
  });

  win.on("blur", () => {
    //  win.hide();
  });

  win.on("show", () => {
    visible = true;
    findWidgetWebContents.send("reset-play-sound", "find");
  });

  win.on("hide", () => {
    visible = false;
    findWidgetWebContents.send("reset-play-sound", "findHide");
  });
})();


            
module.exports = {
  toggle: toggle,
  prepareToKillFindWidget() { killFindWidget = true }
}
