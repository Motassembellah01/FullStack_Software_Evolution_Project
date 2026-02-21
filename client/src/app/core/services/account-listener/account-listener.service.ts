import { Injectable } from '@angular/core';
import { Account } from '@app/core/interfaces/account/account';
import { AccountFriend } from '@app/core/interfaces/account/account_friends';
import { FriendRequestData } from '@app/core/interfaces/friend-request-data';
import { SocketService } from '@app/core/websocket/services/socket-service/socket.service';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AccountListenerService {
  accounts: AccountFriend[] = [];
  friendRequestsReceived: FriendRequestData[] = [];
  friendsThatUserRequested: string[] = [];
  friends: string[] = [];
  blocked: string[] = [];
  UsersBlockingMe: string[] = [];
  accountsChanged$ = new Subject<void>();
  constructor(private socketService: SocketService) {}

  setUpListeners(): void {
    this.accounts = this.mapAccounts(this.accounts);
    this.accounts = this.mapAccounts(this.accounts);
    this.socketService.on('accountCreated', (accounts: Partial<Account>[]) => {
      this.accounts = this.mapAccounts(accounts);
      this.accountsChanged$.next();
    });

    this.socketService.on('friendRequestsThatUserReceived', (friendRequests: FriendRequestData[]) => {
      this.friendRequestsReceived = friendRequests;
      this.accounts = this.mapAccounts(this.accounts);
      this.accountsChanged$.next();
    });

    this.socketService.on('friendsThatUserRequested', (friendsThatUserRequested: string[]) => {
      this.friendsThatUserRequested = friendsThatUserRequested;
      this.accounts = this.mapAccounts(this.accounts);
      this.accountsChanged$.next();
    });

    this.socketService.on('updateFriendListReceiver', (friendsReceiver: string[]) => {
      this.friends = friendsReceiver;
      this.accounts = this.mapAccounts(this.accounts);
      this.accountsChanged$.next();
    });

    this.socketService.on('updateFriendListSender', (friendsSender: string[]) => {
      this.friends = friendsSender;
      this.accounts = this.mapAccounts(this.accounts);
      this.accountsChanged$.next();
    });

    this.socketService.on('updateBlockedUsers', (blockedUsers: string[]) => {
      this.blocked = blockedUsers;
      this.accounts = this.mapAccounts(this.accounts);
      this.accountsChanged$.next();
    });

    this.socketService.on('updateBlockedBy', (blockedBy: string[]) => {
      this.UsersBlockingMe = blockedBy;
      this.accounts = this.mapAccounts(this.accounts);
      this.accountsChanged$.next();
    });
  }

  mapAccounts(accounts: Partial<Account>[]): AccountFriend[] {
    return accounts.map((account) => {
      return {
        userId: account.userId!,
        pseudonym: account.pseudonym!,
        avatarUrl: account.avatarUrl!,
        isFriend: this.friends.includes(account.userId!),
        isRequestReceived: this.friendRequestsReceived.map((request) => request.senderBasicInfo.userId).includes(account.userId!),
        isRequestSent: this.friendsThatUserRequested.includes(account.userId!),
        isBlocked: this.blocked.includes(account.userId!),
        isBlockingMe: this.UsersBlockingMe.includes(account.userId!)
      };
    });
  }

}
