const path = require('path');
const url = require('url');

global.rootRequire = function(name) {
  return require(path.join(__dirname, name));
};
global.mainPath = path.join(__dirname, "main-process");
global.rendererPath =  path.join(__dirname, "renderer-processes");

const electron = require('electron')
const {app, BrowserWindow, ipcMain, Menu, webContents} = electron;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

require('electron-context-menu')({
    prepend: (params, browserWindow) => [{
        label: 'Rainbow',
        // only show it when right-clicking images 
        visible: params.mediaType === 'image'
    }]
});

(function setupListeners () {
  let findWidgetWebContents;
  
  ipcMain.once("findWidget-webContents-id", (event, arg) => {
    //console.log("findWidgetContentsId received by main: ", event);
    findWidgetWebContents = event.sender;
    requireModulesNeedingFindWidget(findWidgetWebContents);
  });

  // ipcMain.on("register-new-window", (event, arg) => {
  //   console.log("Can findWidget see this?");
  //   findWidgetWebContents.send("register-new-window", event.sender.id);
  // });

})();

// TODO: Make an "Open as epub" button or something, where they can just save the document
function requireModulesNeedingFindWidget(findWidgetWebContents) {
  //require(path.join(__dirname, "main-process", "modal.js")).initialize(findWidgetWebContents);
}


function createWindow () {
  mainWindow = new BrowserWindow({width: 800, height: 600});

  // export main window so findWidget can use this as a parent window
  module.exports.mainWindow = mainWindow;
  const mainMenuTemplate = require(path.join(__dirname, 'main-process', 'menu-templates', 'mainMenuTemplate')).template;
  const menu = Menu.buildFromTemplate(mainMenuTemplate);
  mainWindow.setMenu(menu);
  
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  //mainWindow.webContents.openDevTools()
    
  mainWindow.on('close', () => {
    const allWindows = BrowserWindow.getAllWindows();
    require(path.join(__dirname, 'main-process', '/findWidget.js')).prepareToKillFindWidget();
    
    allWindows.forEach((window) => {
      if (window.id !== mainWindow.id) {
        window.close();
      }
    });
  });
  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    
    mainWindow = null
  });

  
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
