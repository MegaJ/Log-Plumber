// Can get all the web contents and loop through each to have a multiwindow text search
const webContents = require('electron').webContents.getAllWebContents()[0];
const toggleWidget = require('../findWidget').toggle;

module.exports.template = [
    // {
    //   label: 'Edit',
    //   submenu: [
    //     {
    //       role: 'undo'
    //     },
    //     {
    //       role: 'redo'
    //     },
    //     {
    //       type: 'separator'
    //     },
    //     {
    //       role: 'cut'
    //     },
    //     {
    //       role: 'copy'
    //     },
    //     {
    //       role: 'paste'
    //     },
    //     {
    //       role: 'pasteandmatchstyle'
    //     },
    //     {
    //       role: 'delete'
    //     },
    //     {
    //       role: 'selectall'
    //     }
    //   ]
    // },
    {
      label: 'View',
      submenu: [
        {
          role: 'reload'
        },
        {
          role: 'toggledevtools'
        },
        {
          type: 'separator'
        },
        {
          role: 'resetzoom'
        },
        {
          role: 'zoomin'
        },
        {
          role: 'zoomout'
        },
        {
          type: 'separator'
        },
        {
          role: 'togglefullscreen'
        },
        {
          label: 'Find',
          role: 'find',
          accelerator: "CmdOrCtrl+f",
          click() {
            // console.log("It's happening!");
            // webContents.findInPage("12", {findNext: true})
            toggleWidget();
          }
        }
      ]
    },
    {
      role: 'window',
      submenu: [
        {
          role: 'minimize'
        },
        {
          role: 'close'
        }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click () { rootRequire('main-process/help').showHelpDialog() }
        }
      ]
    }
  ];
