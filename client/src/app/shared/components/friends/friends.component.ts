import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { FriendService } from '@app/core/http/services/friend-service/friend.service';
import { AccountListenerService } from '@app/core/services/account-listener/account-listener.service';
import { AccountFriend } from '@app/core/interfaces/account/account_friends';
import { AppMaterialModule } from '@app/modules/material.module';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FRIENDS_EN, FRIENDS_FR } from '@app/core/constants/constants';
import { Subscription } from 'rxjs';
import { CancelConfirmationService } from '@app/core/services/cancel-confirmation/cancel-confirmation.service';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

export enum FriendTab {
    Discover = 'discover',
    Friends = 'friends',
    Requests = 'requests',
    Blocked = 'blocked',
}

@Component({
    selector: 'app-friends',
    standalone: true,
    imports: [CommonModule, FormsModule, MatFormFieldModule, AppMaterialModule, TranslateModule],
    templateUrl: './friends.component.html',
    styleUrls: ['./friends.component.scss'],
    animations: [
        trigger('listAnimation', [
            transition('* => *', [
                query(':enter', [
                    style({ opacity: 0, transform: 'translateY(8px)' }),
                    stagger(40, [
                        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
                    ]),
                ], { optional: true }),
            ]),
        ]),
        trigger('fadeIn', [
            transition(':enter', [
                style({ opacity: 0 }),
                animate('200ms ease-out', style({ opacity: 1 })),
            ]),
        ]),
        trigger('cardEnter', [
            transition(':enter', [
                style({ opacity: 0, transform: 'scale(0.95)' }),
                animate('200ms ease-out', style({ opacity: 1, transform: 'scale(1)' })),
            ]),
        ]),
    ],
})
export class FriendsComponent implements OnInit, OnDestroy {
    readonly FriendTab = FriendTab;

    tabs: string[];
    currentTab: FriendTab = FriendTab.Friends;
    searchTerm: string = '';

    filteredDiscoverList: AccountFriend[] = [];
    filteredFriendsList: AccountFriend[] = [];
    blockedUsersList: AccountFriend[] = [];

    private langChangeSubscription: Subscription;
    private accountsChangeSubscription: Subscription;
    private lastFilteredAccountsLength = 0;

    constructor(
        public accountService: AccountService,
        public accountListenerService: AccountListenerService,
        private readonly friendService: FriendService,
        private translateService: TranslateService,
        public cancelConfirmationService: CancelConfirmationService,
    ) {
        this.updateLanguageDependentProperties();
    }

    ngOnInit(): void {
        this.informUserOfPeopleAlreadyRequestedAtLogin();
        this.getFriendListAtLogin();
        this.getFriendRequestsListAtLogin();
        this.getListAllAccountsExistingAtLogin();
        this.getBlockedUsersListAtLogin();
        this.getBlockedByListAtLogin();
        this.accountListenerService.setUpListeners();

        this.langChangeSubscription = this.translateService.onLangChange.subscribe(() => {
            this.updateLanguageDependentProperties();
        });

        this.accountsChangeSubscription = this.accountListenerService.accountsChanged$.subscribe(() => {
            this.refreshFilteredLists();
        });
    }

    ngOnDestroy(): void {
        if (this.langChangeSubscription) {
            this.langChangeSubscription.unsubscribe();
        }
        if (this.accountsChangeSubscription) {
            this.accountsChangeSubscription.unsubscribe();
        }
    }

    get tabLabel(): { discover: string; friends: string; requests: string; blocked: string } {
        const isFrench = this.translateService.currentLang === 'fr';
        return {
            discover: isFrench ? FRIENDS_FR.discover : FRIENDS_EN.discover,
            friends: isFrench ? FRIENDS_FR.friends : FRIENDS_EN.friends,
            requests: isFrench ? FRIENDS_FR.friendRequest : FRIENDS_EN.friendRequest,
            blocked: isFrench ? FRIENDS_FR.blocked : FRIENDS_EN.blocked,
        };
    }

    get friendCount(): number {
        return this.accountListenerService.accounts.filter((a) => a.isFriend).length;
    }

    get requestCount(): number {
        return this.accountListenerService.friendRequestsReceived.length;
    }

    get blockedCount(): number {
        return this.accountListenerService.blocked.length;
    }

    updateLanguageDependentProperties(): void {
        const isFrench = this.translateService.currentLang === 'fr';
        this.tabs = isFrench
            ? [FRIENDS_FR.discover, FRIENDS_FR.friends, FRIENDS_FR.friendRequest]
            : [FRIENDS_EN.discover, FRIENDS_EN.friends, FRIENDS_EN.friendRequest];
    }

    getListAllAccountsExistingAtLogin(): void {
        this.accountService.getAccounts().subscribe((accounts: any[]) => {
            this.accountListenerService.accounts = this.accountListenerService.mapAccounts(accounts);
            this.refreshFilteredLists();
        });
    }

    informUserOfPeopleAlreadyRequestedAtLogin(): void {
        this.accountService.getFriendsThatUserRequested().subscribe((friends) => {
            this.accountListenerService.friendsThatUserRequested = friends;
        });
    }

    getFriendListAtLogin(): void {
        this.accountService.getFriends().subscribe((friends) => {
            this.accountListenerService.friends = friends;
        });
    }

    getFriendRequestsListAtLogin(): void {
        this.accountService.getFriendRequests().subscribe((friendRequests) => {
            this.accountListenerService.friendRequestsReceived = friendRequests;
        });
    }

    getBlockedUsersListAtLogin(): void {
        this.accountService.getBlockedUsers().subscribe((blockedUsers) => {
            this.accountListenerService.blocked = blockedUsers;
        });
    }

    getBlockedByListAtLogin(): void {
        this.accountService.getBlockedBy().subscribe((blockedBy) => {
            this.accountListenerService.UsersBlockingMe = blockedBy;
        });
    }

    switchTab(tab: FriendTab): void {
        this.currentTab = tab;
        this.refreshFilteredLists();
    }

    onSearchInput(): void {
        this.refreshFilteredLists();
    }

    clearSearch(): void {
        this.searchTerm = '';
        this.refreshFilteredLists();
    }

    refreshFilteredLists(): void {
        const term = this.searchTerm.toLowerCase();
        const accounts = this.accountListenerService.accounts;

        this.filteredDiscoverList = accounts.filter(
            (a) =>
                !a.isFriend &&
                !a.isBlocked &&
                !a.isBlockingMe &&
                a.userId !== this.accountService.auth0Id &&
                a.pseudonym.toLowerCase().includes(term),
        );

        this.filteredFriendsList = accounts.filter(
            (a) => a.isFriend && a.pseudonym.toLowerCase().includes(term),
        );

        this.blockedUsersList = accounts.filter(
            (a) => a.isBlocked && a.pseudonym.toLowerCase().includes(term),
        );

        this.lastFilteredAccountsLength = accounts.length;
    }

    getFilteredList(): AccountFriend[] {
        if (this.accountListenerService.accounts.length !== this.lastFilteredAccountsLength) {
            this.refreshFilteredLists();
        }

        if (this.currentTab === FriendTab.Discover) {
            return this.filteredDiscoverList;
        }
        if (this.currentTab === FriendTab.Friends) {
            return this.filteredFriendsList;
        }
        return [];
    }

    getRequestForUser(userId: string) {
        return this.accountListenerService.friendRequestsReceived.find(
            (r) => r.senderBasicInfo.userId === userId,
        );
    }

    sendFriendRequest(userId: string): void {
        this.friendService.sendFriendRequest(userId).subscribe(() => {
            this.refreshFilteredLists();
        });
    }

    cancelFriendRequest(receiverId: string, pseudonym: string): void {
        const dialogMessage =
            this.translateService.currentLang === 'fr'
                ? `annuler la demande d'ami envoyée à ${pseudonym}`
                : `cancel the friend request sent to ${pseudonym}`;

        this.cancelConfirmationService.askConfirmation(() => {
            this.friendService.cancelFriendRequest(receiverId).subscribe(() => {
                this.refreshFilteredLists();
            });
        }, dialogMessage);
    }

    acceptFriendRequest(requestId: string): void {
        this.friendService.acceptFriendRequest(requestId).subscribe(() => {
            this.refreshFilteredLists();
        });
    }

    rejectFriendRequest(requestId: string): void {
        this.friendService.rejectFriendRequest(requestId).subscribe(() => {
            this.refreshFilteredLists();
        });
    }

    removeFriend(friendId: string, pseudonym: string): void {
        const dialogMessage =
            this.translateService.currentLang === 'fr'
                ? `retirer ${pseudonym} de vos amis`
                : `remove ${pseudonym} from your friends`;

        this.cancelConfirmationService.askConfirmation(() => {
            this.friendService.removeFriend(friendId).subscribe(() => {
                this.refreshFilteredLists();
            });
        }, dialogMessage);
    }

    blockNormalUser(blockedUserId: string, pseudonym: string): void {
        const dialogMessage =
            this.translateService.currentLang === 'fr'
                ? `bloquer ${pseudonym}`
                : `block ${pseudonym}`;

        this.cancelConfirmationService.askConfirmation(() => {
            this.friendService.blockNormalUser(blockedUserId).subscribe(() => {
                this.refreshFilteredLists();
            });
        }, dialogMessage);
    }

    blockFriend(blockedFriendId: string, pseudonym: string): void {
        const dialogMessage =
            this.translateService.currentLang === 'fr'
                ? `bloquer votre ami ${pseudonym}`
                : `block your friend ${pseudonym}`;

        this.cancelConfirmationService.askConfirmation(() => {
            this.friendService.blockFriend(blockedFriendId).subscribe(() => {
                this.refreshFilteredLists();
            });
        }, dialogMessage);
    }

    blockUserWithPendingRequest(otherUserId: string, pseudonym: string): void {
        const dialogMessage =
            this.translateService.currentLang === 'fr'
                ? `bloquer ${pseudonym}`
                : `block ${pseudonym}`;

        this.cancelConfirmationService.askConfirmation(() => {
            this.friendService.blockUserWithPendingRequest(otherUserId).subscribe(() => {
                this.refreshFilteredLists();
            });
        }, dialogMessage);
    }

    unblockUser(blockedUserId: string, pseudonym: string): void {
        const dialogMessage =
            this.translateService.currentLang === 'fr'
                ? `débloquer ${pseudonym}`
                : `unblock ${pseudonym}`;

        this.cancelConfirmationService.askConfirmation(() => {
            this.friendService.unblockUser(blockedUserId).subscribe(() => {
                this.refreshFilteredLists();
            });
        }, dialogMessage);
    }
}
