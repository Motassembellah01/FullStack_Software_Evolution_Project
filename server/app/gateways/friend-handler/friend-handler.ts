import { FriendRequestDto } from '@app/model/dto/friend-request/friend-request-dto';
import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Push gateway for friend-domain projection updates.
 * It keeps a lightweight in-memory map from userId to socketId so
 * account/friend projection changes can be streamed to connected users.
 */
@WebSocketGateway()
export class FriendHandlerGateway {
    @WebSocketServer()
    server: Server;
    private readonly logger = new Logger(FriendHandlerGateway.name);
    // userId -> socketId mapping for currently connected users.
    private onlineUsers = new Map<string, string>();

    // Called when a client starts listening for friend updates.
    @SubscribeMessage('register')
    async handleRegister(@MessageBody() userId: string, @ConnectedSocket() client: Socket): Promise<void> {
        this.onlineUsers.set(userId, client.id);
        this.logger.log(`User ${userId} registered with socket ${client.id}`);
    }

    // Called on client disconnect flow to avoid stale socket mappings.
    @SubscribeMessage('unregister')
    handleUnregister(@MessageBody() userId: string): void {
        if (this.onlineUsers.has(userId)) {
            this.onlineUsers.delete(userId);
        }
        this.logger.log(`User ${userId} unregistered`);
    }

    // Pushes the current user's outgoing friend-request list.
    emitFriendRequestsSentUpdated(userId: string, sentFriendRequestIds: string[]): void {
        const socketId = this.onlineUsers.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('friendRequestsSentUpdated', sentFriendRequestIds);
        }
    }

    // Pushes the current user's incoming friend-request list.
    emitFriendRequestsReceivedUpdated(userId: string, receivedFriendRequests: FriendRequestDto[]): void {
        const socketId = this.onlineUsers.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('friendRequestsReceivedUpdated', receivedFriendRequests);
        }
    }

    // Pushes updated friend list for a given user.
    emitFriendsUpdated(userId: string, friendIds: string[]): void {
        const socketId = this.onlineUsers.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('friendsUpdated', friendIds);
        }
    }

    // Pushes updated list of users blocked by current user.
    emitBlockedUsersUpdated(userId: string, blockedUsers: string[]): void {
        const socketId = this.onlineUsers.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('blockedUsersUpdated', blockedUsers);
        }
    }

    // Pushes updated list of users blocking current user.
    emitBlockedByUsersUpdated(userId: string, blockedByUserIds: string[]): void {
        const socketId = this.onlineUsers.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('blockedByUsersUpdated', blockedByUserIds);
        }
    }
}