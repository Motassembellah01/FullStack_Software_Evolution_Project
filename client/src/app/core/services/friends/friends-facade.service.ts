import { Injectable } from '@angular/core';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { FriendService } from '@app/core/http/services/friend-service/friend.service';
import { FriendRequestData } from '@app/core/interfaces/friend-request-data';
import { AccountListenerService } from '@app/core/services/account-listener/account-listener.service';
import { BehaviorSubject, Observable, combineLatest, forkJoin, map } from 'rxjs';
import { FriendViewLists, buildFriendViewLists } from './friend-list.utils';

/**
 * UI-facing friend application facade.
 *
 * Responsibilities:
 * - bootstrap friend-related state from HTTP endpoints
 * - compose a presentation-ready view model stream
 * - expose friend commands as intent methods for components
 */
export interface FriendsViewModel {
    discoverList: FriendViewLists['discover'];
    friendsList: FriendViewLists['friends'];
    blockedList: FriendViewLists['blocked'];
    requestList: FriendRequestData[];
    friendCount: number;
    requestCount: number;
    blockedCount: number;
}

@Injectable({
    providedIn: 'root',
})
export class FriendsFacadeService {
    // Search input is modeled as a stream to keep filtering reactive and deterministic.
    private readonly searchTermSubject = new BehaviorSubject<string>('');

    // Main friend panel view model used by FriendsComponent.
    readonly viewModel$ = combineLatest([
        this.accountListenerService.accounts$,
        this.accountListenerService.friendRequestsReceived$,
        this.accountListenerService.blocked$,
        this.searchTermSubject.asObservable(),
    ]).pipe(
        map(([accounts, friendRequests, blockedUsers, searchTerm]) => {
            const lists = buildFriendViewLists(accounts, this.accountService.auth0Id, searchTerm);
            return {
                discoverList: lists.discover,
                friendsList: lists.friends,
                blockedList: lists.blocked,
                requestList: friendRequests,
                friendCount: accounts.filter((account) => account.isFriend).length,
                requestCount: friendRequests.length,
                blockedCount: blockedUsers.length,
            } satisfies FriendsViewModel;
        }),
    );

    constructor(
        private readonly accountService: AccountService,
        private readonly friendService: FriendService,
        private readonly accountListenerService: AccountListenerService,
    ) {}

    /**
     * Initial friend bootstrap done in a single network fan-out.
     * This prevents partial UI states where relation slices are out of sync.
     */
    initializeData(): Observable<void> {
        return forkJoin({
            accounts: this.accountService.getAccounts(),
            friends: this.accountService.getFriends(),
            friendRequests: this.accountService.getFriendRequests(),
            friendsRequested: this.accountService.getFriendsThatUserRequested(),
            blockedUsers: this.accountService.getBlockedUsers(),
            blockedBy: this.accountService.getBlockedBy(),
        }).pipe(
            map(({ accounts, friends, friendRequests, friendsRequested, blockedUsers, blockedBy }) => {
                this.accountListenerService.setInitialFriendState(accounts, friends, friendRequests, friendsRequested, blockedUsers, blockedBy);
            }),
        );
    }

    // Updates reactive search filter used by the view-model stream.
    setSearchTerm(searchTerm: string): void {
        this.searchTermSubject.next(searchTerm);
    }

    // Convenience lookup used by request accept/reject buttons in discover tab.
    getRequestForUser(userId: string): { requestId: string } | undefined {
        return this.accountListenerService.friendRequestsReceived.find((request) => request.senderBasicInfo.userId === userId);
    }

    // Command passthroughs below intentionally keep side effects in backend + listener streams.
    sendFriendRequest(userId: string): Observable<void> {
        return this.friendService.sendFriendRequest(userId);
    }

    cancelFriendRequest(receiverId: string): Observable<void> {
        return this.friendService.cancelFriendRequest(receiverId);
    }

    acceptFriendRequest(requestId: string): Observable<void> {
        return this.friendService.acceptFriendRequest(requestId);
    }

    rejectFriendRequest(requestId: string): Observable<void> {
        return this.friendService.rejectFriendRequest(requestId);
    }

    removeFriend(friendId: string): Observable<void> {
        return this.friendService.removeFriend(friendId);
    }

    blockNormalUser(blockedUserId: string): Observable<void> {
        return this.friendService.blockNormalUser(blockedUserId);
    }

    blockFriend(blockedFriendId: string): Observable<void> {
        return this.friendService.blockFriend(blockedFriendId);
    }

    blockUserWithPendingRequest(otherUserId: string): Observable<void> {
        return this.friendService.blockUserWithPendingRequest(otherUserId);
    }

    unblockUser(blockedUserId: string): Observable<void> {
        return this.friendService.unblockUser(blockedUserId);
    }
}
