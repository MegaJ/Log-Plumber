function initialize (findWidgetWebContents) {
  const path = require('path');
  const {ipcMain, BrowserWindow, Menu} = require('electron');

  const modalPath = path.join('file://', rendererPath, 'modal', './modal.html');
  const template = rootRequire('main-process/menu-templates/modalMenuTemplate').template;

  ipcMain.on("open-new-window", showModal);

  function showModal(evt, arg) { // [b], synchronous operation ~150ms.
    let win = new BrowserWindow({ width: 400,
                                  height: 320,
                                  show: false});   
    
    const menu = Menu.buildFromTemplate(template);
    win.setMenu(menu);
    win.on('close', function () { win = null });
    win.loadURL(modalPath);

    // TODO: do this within an 'on ready' event
    win.show();
    
    findWidgetWebContents.send("register-new-window");
    findWidgetWebContents.send("reset-play-sound", "notification");
  }
}

module.exports = {
  initialize: initialize
}
