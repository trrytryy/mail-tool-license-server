const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Add icon if available
    title: 'Mail Pro Tool'
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS it is common for applications to stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
const storage = require('./storage');
const mailer = require('./mailer');
const license = require('./license');

let isSending = false;
let sendProcess = null;

// Storage IPC
ipcMain.handle('storage:read', async (event, key) => {
  return await storage.read(key);
});

ipcMain.handle('storage:write', async (event, key, data) => {
  return await storage.write(key, data);
});

// License IPC
ipcMain.handle('license:validate', async (event, key) => {
  return await license.validate(key);
});

ipcMain.handle('license:isActivated', async () => {
  return await license.isActivated();
});

ipcMain.handle('license:getMachineId', async () => {
  return license.getMachineId();
});

// Mailer IPC
ipcMain.handle('mailer:sendBulk', async (event, config) => {
  if (isSending) {
    throw new Error('Already sending emails');
  }

  isSending = true;
  sendProcess = mailer.sendBulk(config, (log) => {
    mainWindow.webContents.send('log:update', log);
  });

  try {
    const result = await sendProcess;
    return result;
  } finally {
    isSending = false;
    sendProcess = null;
  }
});

ipcMain.handle('mailer:stop', () => {
  if (sendProcess) {
    mailer.stop();
    isSending = false;
    sendProcess = null;
  }
});

ipcMain.handle('mailer:pause', () => {
  mailer.pause();
});

ipcMain.handle('mailer:resume', () => {
  mailer.resume();
});

ipcMain.handle('mailer:getStats', () => {
  return mailer.getQueueStats();
});

ipcMain.handle('mailer:test', async (event, smtpConfig, testEmail) => {
  return await mailer.testConnection(smtpConfig, testEmail);
});