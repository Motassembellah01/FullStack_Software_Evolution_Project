const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
    getProfile: () => ipcRenderer.invoke('auth:get-profile'),
    logOut: () => ipcRenderer.send('auth:log-out'),
    logIn: () => ipcRenderer.send('auth:log-in'),
    getPrivateData: () => ipcRenderer.invoke('api:get-private-data'),
    getAccessToken: () => ipcRenderer.invoke('auth:get-access-token'),
    getServerUrl: () => ipcRenderer.invoke('app:get-server-url'),
    openChatWindow: () => ipcRenderer.invoke('window:open-chat-window'),
    isChatClosed: (callback) =>
        ipcRenderer.on('fromMain', (event, message) => {
            callback(message);
        }),
};

process.once('loaded', () => {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
});
