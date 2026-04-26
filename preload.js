const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Storage
  storageRead: (key) => ipcRenderer.invoke('storage:read', key),
  storageWrite: (key, data) => ipcRenderer.invoke('storage:write', key, data),

  // License
  licenseValidate: (key) => ipcRenderer.invoke('license:validate', key),
  licenseIsActivated: () => ipcRenderer.invoke('license:isActivated'),
  licenseCheck: () => ipcRenderer.invoke('license:check'),
  licenseGetMachineId: () => ipcRenderer.invoke('license:getMachineId'),

  // Mailer
  mailerSendBulk: (config) => ipcRenderer.invoke('mailer:sendBulk', config),
  mailerStop: () => ipcRenderer.invoke('mailer:stop'),
  mailerPause: () => ipcRenderer.invoke('mailer:pause'),
  mailerResume: () => ipcRenderer.invoke('mailer:resume'),
  mailerGetStats: () => ipcRenderer.invoke('mailer:getStats'),
  mailerTest: (smtpConfig, testEmail) => ipcRenderer.invoke('mailer:test', smtpConfig, testEmail),

  // Logs
  onLogUpdate: (callback) => ipcRenderer.on('log:update', callback)
});