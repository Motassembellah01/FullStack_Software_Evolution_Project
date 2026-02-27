import { Injectable } from '@angular/core';
import { Account } from '@app/core/interfaces/account/account';
import { AccountFriend } from '@app/core/interfaces/account/account_friends';
import { FriendRequestData } from '@app/core/interfaces/friend-request-data';
import { SocketService } from '@app/core/websocket/services/socket-service/socket.service';
import { BehaviorSubject, Subject, combineLatest, map, shareReplay } from 'rxjs';

/**
 * Reactive read-model store for friend/account relationship state.
 *
 * This service receives socket updates and exposes derived streams that the UI can consume.
 * It intentionally keeps relationship projection logic in one place.
 */
@Injectable({
    providedIn: 'root',
})
export class AccountListenerService {
    // Compatibility event stream used by some existing consumers.
    accountsChanged$ = new Subject<void>();

    // Raw state slices received from HTTP bootstrap + websocket updates.
    private readonly rawAccountsSubject = new BehaviorSubject<Partial<Account>[]>([]);
    private readonly friendRequestsReceivedSubject = new BehaviorSubject<FriendRequestData[]>([]);
    private readonly friendsThatUserRequestedSubject = new BehaviorSubject<string[]>([]);
    private readonly friendsSubject = new BehaviorSubject<string[]>([]);
    private readonly blockedSubject = new BehaviorSubject<string[]>([]);
    private readonly usersBlockingMeSubject = new BehaviorSubject<string[]>([]);

    // Synchronous snapshot kept for compatibility with non-reactive consumers.
    private accountsSnapshot: AccountFriend[] = [];

    // Exposed read streams for each raw relationship slice.
    readonly rawAccounts$ = this.rawAccountsSubject.asObservable();
    readonly friendRequestsReceived$ = this.friendRequestsReceivedSubject.asObservable();
    readonly friendsThatUserRequested$ = this.friendsThatUserRequestedSubject.asObservable();
    readonly friends$ = this.friendsSubject.asObservable();
    readonly blocked$ = this.blockedSubject.asObservable();
    readonly usersBlockingMe$ = this.usersBlockingMeSubject.asObservable();

    // Main derived stream consumed by facade/components.
    readonly accounts$ = combineLatest([
        this.rawAccounts$,
        this.friendRequestsReceived$,
        this.friendsThatUserRequested$,
        this.friends$,
        this.blocked$,
        this.usersBlockingMe$,
    ]).pipe(
        map(([rawAccounts, friendRequestsReceived, friendsThatUserRequested, friends, blocked, usersBlockingMe]) =>
            this.mapAccounts(rawAccounts, friendRequestsReceived, friendsThatUserRequested, friends, blocked, usersBlockingMe),
        ),
        shareReplay(1),
    );

    private listenersInitialized = false;

    constructor(private readonly socketService: SocketService) {
        // Keep legacy snapshot + change event synchronized with reactive stream.
        this.accounts$.subscribe((accounts) => {
            this.accountsSnapshot = accounts;
            this.accountsChanged$.next();
        });
    }

    get accounts(): AccountFriend[] {
        return this.accountsSnapshot;
    }

    get friendRequestsReceived(): FriendRequestData[] {
        return this.friendRequestsReceivedSubject.value;
    }

    set friendRequestsReceived(friendRequestsReceived: FriendRequestData[]) {
        this.friendRequestsReceivedSubject.next([...friendRequestsReceived]);
    }

    get friendsThatUserRequested(): string[] {
        return this.friendsThatUserRequestedSubject.value;
    }

    set friendsThatUserRequested(friendsThatUserRequested: string[]) {
        this.friendsThatUserRequestedSubject.next([...friendsThatUserRequested]);
    }

    get friends(): string[] {
        return this.friendsSubject.value;
    }

    set friends(friends: string[]) {
        this.friendsSubject.next([...friends]);
    }

    get blocked(): string[] {
        return this.blockedSubject.value;
    }

    set blocked(blockedUsers: string[]) {
        this.blockedSubject.next([...blockedUsers]);
    }

    get usersBlockingMe(): string[] {
        return this.usersBlockingMeSubject.value;
    }

    set usersBlockingMe(usersBlockingMe: string[]) {
        this.usersBlockingMeSubject.next([...usersBlockingMe]);
    }

    // Used when account list arrives through bootstrap or account-created websocket event.
    setRawAccounts(rawAccounts: Partial<Account>[]): void {
        this.rawAccountsSubject.next([...rawAccounts]);
    }

    setInitialFriendState(
        rawAccounts: Partial<Account>[],
        friends: string[],
        friendRequestsReceived: FriendRequestData[],
        friendsThatUserRequested: string[],
        blockedUsers: string[],
        usersBlockingMe: string[],
    ): void {
        // Batch initial state setup in one place so relation derivation stays deterministic.
        this.rawAccountsSubject.next([...rawAccounts]);
        this.friendsSubject.next([...friends]);
        this.friendRequestsReceivedSubject.next([...friendRequestsReceived]);
        this.friendsThatUserRequestedSubject.next([...friendsThatUserRequested]);
        this.blockedSubject.next([...blockedUsers]);
        this.usersBlockingMeSubject.next([...usersBlockingMe]);
    }

    // Registers friend-domain websocket listeners exactly once.
    setUpListeners(): void {
        if (this.listenersInitialized) {
            return;
        }
        this.listenersInitialized = true;

        this.socketService.on('accountCreated', (accounts: Partial<Account>[]) => {
            this.setRawAccounts(accounts);
        });

        this.socketService.on('friendRequestsReceivedUpdated', (friendRequests: FriendRequestData[]) => {
            this.friendRequestsReceived = friendRequests;
        });

        this.socketService.on('friendRequestsSentUpdated', (friendsThatUserRequested: string[]) => {
            this.friendsThatUserRequested = friendsThatUserRequested;
        });

        this.socketService.on('friendsUpdated', (friendIds: string[]) => {
            this.friends = friendIds;
        });

        this.socketService.on('blockedUsersUpdated', (blockedUsers: string[]) => {
            this.blocked = blockedUsers;
        });

        this.socketService.on('blockedByUsersUpdated', (blockedByUserIds: string[]) => {
            this.usersBlockingMe = blockedByUserIds;
        });
    }

    /**
     * Derives relation flags for each account.
     * This method is pure relative to provided arguments and can be reused in tests.
     */
    private mapAccounts(
        rawAccounts: Partial<Account>[],
        friendRequestsReceived: FriendRequestData[],
        friendsThatUserRequested: string[],
        friends: string[],
        blockedUsers: string[],
        usersBlockingMe: string[],
    ): AccountFriend[] {
        const requestSenderIds = friendRequestsReceived
            .map((request) => request.senderBasicInfo.userId)
            .filter((userId): userId is string => Boolean(userId));

        return rawAccounts
            .filter((account) => Boolean(account.userId && account.pseudonym))
            .map((account) => {
                const userId = account.userId ?? '';
                return {
                    userId,
                    pseudonym: account.pseudonym ?? '',
                    avatarUrl: account.avatarUrl ?? '',
                    isFriend: friends.includes(userId),
                    isRequestReceived: requestSenderIds.includes(userId),
                    isRequestSent: friendsThatUserRequested.includes(userId),
                    isBlocked: blockedUsers.includes(userId),
                    isBlockingMe: usersBlockingMe.includes(userId),
                };
            });
    }
}
