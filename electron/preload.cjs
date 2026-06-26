const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('localOneDesktop', {
  chooseFolder: () => ipcRenderer.invoke('local-one:choose-folder'),
});
