const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let serverHandle;
let mainWindow;

async function startServer() {
  const serverModule = await import(pathToFileURL(path.join(__dirname, '../server/index.js')).href);
  serverHandle = await serverModule.startLocalOneServer({
    port: Number(process.env.LOCAL_ONE_PORT || 47110),
    staticDir: path.join(__dirname, '../dist'),
    openBrowser: false,
  });
  return serverHandle;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 980,
    minHeight: 720,
    title: 'Local ONE',
    backgroundColor: '#f7faf9',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.loadURL(url);
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  process.env.LOCAL_ONE_DATA_DIR ||= path.join(app.getPath('userData'), 'data');
  const handle = await startServer();
  createWindow(`http://127.0.0.1:${handle.port}`);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverHandle) {
    createWindow(`http://127.0.0.1:${serverHandle.port}`);
  }
});

app.on('before-quit', async () => {
  if (serverHandle?.close) {
    await serverHandle.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('local-one:choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});
