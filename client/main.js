const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { app, ipcMain, BrowserWindow } = require('electron');

const { createAuthWindow, createLogoutWindow } = require('./electron/auth-process');
const { createAppWindow } = require('./electron/app-process');
const { createChatWin } = require('./electron/chat-process');
const authService = require('./electron/auth-service');

async function showWindow() {
    try {
        await authService.refreshTokens();
        createAppWindow();
    } catch (err) {
        createAuthWindow();
    }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    // Handle IPC messages from the renderer process.
    ipcMain.handle('auth:get-profile', authService.getProfile);
    ipcMain.on('auth:log-out', () => {
        BrowserWindow.getAllWindows().forEach((window) => window.close());
        createLogoutWindow();
    });
    ipcMain.on('auth:log-in', async () => {
        BrowserWindow.getAllWindows().forEach((window) => window.close());
        createLogoutWindow();
    });
    ipcMain.handle('auth:get-access-token', authService.getAccessToken);
    ipcMain.handle('app:get-server-url', () => process.env.SERVER_URL || 'http://localhost:3000');
    ipcMain.handle('window:open-chat-window', () => {
        createChatWin();
    });
    showWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    app.quit();
});
