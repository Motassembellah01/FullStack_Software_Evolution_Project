import { Injectable } from '@angular/core';
import { ChatSocketsEmitEvents } from '@app/core/constants/constants';
import { ServerConfigService } from '@app/core/services/server-config/server-config.service';
import { io, Socket } from 'socket.io-client';

/**
 * This service allows us to keep one socket instance through all the app and handle the
 * communication with the server socket in a general way without business logic.
 */
@Injectable({
    providedIn: 'root',
})
export class SocketService {
    socket: Socket;
    auth0Id: string;

    isSocketAlive(): boolean {
        return this.socket?.connected;
    }

    /**
     * This method should be call before using any other web socket feature.
     * You can use isSocketAlive to validate is already connected.
     */
    constructor(private readonly serverConfig: ServerConfigService) {}

    connect(): void {
        if (this.isSocketAlive()) return;
        this.socket = io(this.serverConfig.serverUrlRoot, { transports: ['websocket'], upgrade: false });
        (window as any).electronAPI.getProfile().then((profile: any) => {
            if (!profile) return;
            this.send(ChatSocketsEmitEvents.UserInfo, profile?.sub as string);
            this.auth0Id = profile?.sub;
            this.socket.emit('register', this.auth0Id);
        });
    }

    disconnect(): void {
        this.socket.disconnect();
        this.socket.emit('unregister', this.auth0Id);
    }

    on<T>(event: string, action: (data: T) => void): void {
        if (this.socket.hasListeners(event)) {
            this.socket.removeListener(event);
        }
        this.socket.on(event, action);
    }

    removeListener(event: string): void {
        if (this.socket.hasListeners(event)) {
            this.socket.removeListener(event);
        }
    }

    /*
     * The callback after sending a message doesn't work because NestJS doesn't implement it
     */
    // eslint-disable-next-line @typescript-eslint/ban-types
    send<T>(event: string, data?: T, callback?: Function): void {
        this.socket.emit(event, ...[data, callback].filter((x) => x));
    }
}
