import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ServerConfigService } from '@app/core/services/server-config/server-config.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  auth0Id: string;
  constructor(
    private readonly http: HttpClient,
    private readonly serverConfig: ServerConfigService,
  ) {}

  sendFriendRequest(receiverId: string): Observable<void> {
    return this.http.post<void>(
      `${this.serverConfig.serverUrl}/friends/send/${this.auth0Id}/${receiverId}`,
      {}
    );
  }

  acceptFriendRequest(requestId: string): Observable<void> {
    return this.http.post<void>(
      `${this.serverConfig.serverUrl}/friends/accept/${requestId}`,
      {}
    );
  }

  rejectFriendRequest(requestId: string): Observable<void> {
    return this.http.post<void>(
      `${this.serverConfig.serverUrl}/friends/reject/${requestId}`,
      {}
    );
  }

  removeFriend(friendId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.serverConfig.serverUrl}/friends/remove/${this.auth0Id}/${friendId}`
    );
  }

  blockNormalUser(blockedUserId: string): Observable<void> {
    return this.http.post<void>(
      `${this.serverConfig.serverUrl}/friends/block/${this.auth0Id}/${blockedUserId}`,
      {}
    );
  }

  blockFriend(blockedFriendId: string): Observable<void>{
    return this.http.post<void>(
      `${this.serverConfig.serverUrl}/friends/blockFriend/${this.auth0Id}/${blockedFriendId}`,
      {}
    );
  }

  blockUserWithPendingRequest(otherUserId: string): Observable<void> {
    return this.http.post<void>(
      `${this.serverConfig.serverUrl}/friends/blockUserWithPendingRequest/${this.auth0Id}/${otherUserId}`,
      {}
    );
  }
}
