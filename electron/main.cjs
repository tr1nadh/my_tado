const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
	const window = new BrowserWindow({
		width: 1440,
		height: 920,
		minWidth: 980,
		minHeight: 720,
		backgroundColor: '#06111f',
		autoHideMenuBar: true,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true
		}
	});

	window.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: 'deny' };
	});

	if (isDev) {
		window.loadURL('http://127.0.0.1:5173');
		return;
	}

	window.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
}

app.whenReady().then(() => {
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
