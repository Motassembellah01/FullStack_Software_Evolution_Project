import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ServerConfigService } from '@app/core/services/server-config/server-config.service';
import { Observable } from 'rxjs';

/**
 * Transport-only service for friend HTTP commands.
 * No business rules should live here; this layer only maps method calls to endpoints.
 */
@Injectable({
    providedIn: 'root',
})
export class FriendService {
    // Auth0 subject of the current user, injected by app bootstrap flow.
    auth0Id: string;

    constructor(
        private readonly http: HttpClient,
        private readonly serverConfig: ServerConfigService,
    ) {}

    // Single place for actor identity used by command endpoints.
    private get actorUserId(): string {
        return this.auth0Id;
    }

    // Sends a new pending friend request from current user to receiver.
    sendFriendRequest(receiverId: string): Observable<void> {
        return this.http.post<void>(`${this.serverConfig.serverUrl}/friends/send/${this.actorUserId}/${receiverId}`, {});
    }

    // Accepts a pending request by requestId.
    acceptFriendRequest(requestId: string): Observable<void> {
        return this.http.post<void>(`${this.serverConfig.serverUrl}/friends/accept/${requestId}`, {});
    }

    // Rejects a pending request by requestId.
    rejectFriendRequest(requestId: string): Observable<void> {
        return this.http.post<void>(`${this.serverConfig.serverUrl}/friends/reject/${requestId}`, {});
    }

    // Removes friendship edge between current user and target friend.
    removeFriend(friendId: string): Observable<void> {
        return this.http.delete<void>(`${this.serverConfig.serverUrl}/friends/remove/${this.actorUserId}/${friendId}`);
    }

    // Blocks a non-friend user.
    blockNormalUser(blockedUserId: string): Observable<void> {
        return this.http.post<void>(`${this.serverConfig.serverUrl}/friends/block/${this.actorUserId}/${blockedUserId}`, {});
    }

    // Blocks a current friend (also removes friendship server-side).
    blockFriend(blockedFriendId: string): Observable<void> {
        return this.http.post<void>(`${this.serverConfig.serverUrl}/friends/blockFriend/${this.actorUserId}/${blockedFriendId}`, {});
    }

    // Blocks a user while deleting the related pending request.
    blockUserWithPendingRequest(otherUserId: string): Observable<void> {
        return this.http.post<void>(`${this.serverConfig.serverUrl}/friends/blockUserWithPendingRequest/${this.actorUserId}/${otherUserId}`, {});
    }

    // Cancels a pending request sent by current user.
    cancelFriendRequest(receiverId: string): Observable<void> {
        return this.http.post<void>(`${this.serverConfig.serverUrl}/friends/cancelRequest/${this.actorUserId}/${receiverId}`, {});
    }

    // Removes a user from current user's block list.
    unblockUser(blockedUserId: string): Observable<void> {
        return this.http.post<void>(`${this.serverConfig.serverUrl}/friends/unblock/${this.actorUserId}/${blockedUserId}`, {});
    }
}
