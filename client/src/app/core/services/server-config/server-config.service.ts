import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

/**
 * Provides server base URL. In Electron, reads from .env via main process (getServerUrl).
 * In browser, uses environment.serverUrl / environment.serverUrlRoot.
 */
@Injectable({
    providedIn: 'root',
})
export class ServerConfigService {
    private _serverUrl: string = environment.serverUrl;
    private _serverUrlRoot: string = environment.serverUrlRoot;

    get serverUrl(): string {
        return this._serverUrl;
    }

    get serverUrlRoot(): string {
        return this._serverUrlRoot;
    }

    /**
     * Load config from Electron main process when available (Electron app with .env).
     * Call this in APP_INITIALIZER so the app waits for it before starting.
     */
    load(): Promise<void> {
        const electronAPI = (window as unknown as { electronAPI?: { getServerUrl?: () => Promise<string> } }).electronAPI;
        if (electronAPI?.getServerUrl) {
            return electronAPI.getServerUrl().then((base) => {
                const url = (base || '').replace(/\/$/, '');
                this._serverUrl = url ? `${url}/api` : environment.serverUrl;
                this._serverUrlRoot = url ? `${url}/` : environment.serverUrlRoot;
            });
        }
        return Promise.resolve();
    }
}
