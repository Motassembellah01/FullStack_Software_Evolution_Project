import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { AccountListenerService } from '@app/core/services/account-listener/account-listener.service';
import { AccountFriend } from '@app/core/interfaces/account/account_friends';
import { AppMaterialModule } from '@app/modules/material.module';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FRIENDS_EN, FRIENDS_FR } from '@app/core/constants/constants';
import { Subscription } from 'rxjs';
import { CancelConfirmationService } from '@app/core/services/cancel-confirmation/cancel-confirmation.service';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { FriendsFacadeService, FriendsViewModel } from '@app/core/services/friends/friends-facade.service';
import { FriendRequestData } from '@app/core/interfaces/friend-request-data';

/**
 * Presentational friend panel component.
 *
 * All heavy relation/state logic stays in FriendsFacadeService and
 * AccountListenerService; this component focuses on rendering and user actions.
 */
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
    readonly pageSize = 8;

    // Local UI state (view mode + search value).
    tabs: string[];
    currentTab: FriendTab = FriendTab.Friends;
    searchTerm: string = '';
    private readonly pageByTab: Record<FriendTab, number> = {
        [FriendTab.Discover]: 0,
        [FriendTab.Friends]: 0,
        [FriendTab.Requests]: 0,
        [FriendTab.Blocked]: 0,
    };

    // Data slices bound directly by template.
    filteredDiscoverList: AccountFriend[] = [];
    filteredFriendsList: AccountFriend[] = [];
    blockedUsersList: AccountFriend[] = [];
    friendRequestsList: FriendRequestData[] = [];
    pagedDiscoverList: AccountFriend[] = [];
    pagedFriendsList: AccountFriend[] = [];
    pagedBlockedUsersList: AccountFriend[] = [];
    pagedFriendRequestsList: FriendRequestData[] = [];
    friendCount = 0;
    requestCount = 0;
    blockedCount = 0;

    private langChangeSubscription: Subscription;
    private viewModelSubscription: Subscription;
    constructor(
        public accountService: AccountService,
        public accountListenerService: AccountListenerService,
        private readonly friendsFacadeService: FriendsFacadeService,
        private translateService: TranslateService,
        public cancelConfirmationService: CancelConfirmationService,
    ) {
        this.updateLanguageDependentProperties();
    }

    ngOnInit(): void {
        // 1) HTTP bootstrap
        this.friendsFacadeService.initializeData().subscribe(() => {
            this.friendsFacadeService.setSearchTerm(this.searchTerm);
        });
        // 2) websocket live updates
        this.accountListenerService.setUpListeners();

        this.langChangeSubscription = this.translateService.onLangChange.subscribe(() => {
            this.updateLanguageDependentProperties();
        });

        // 3) bind reactive view model to template-facing fields
        this.viewModelSubscription = this.friendsFacadeService.viewModel$.subscribe((viewModel: FriendsViewModel) => {
            this.applyViewModel(viewModel);
        });
    }

    ngOnDestroy(): void {
        if (this.langChangeSubscription) {
            this.langChangeSubscription.unsubscribe();
        }
        if (this.viewModelSubscription) {
            this.viewModelSubscription.unsubscribe();
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

    // Rebuilds tab labels when language changes.
    updateLanguageDependentProperties(): void {
        const isFrench = this.translateService.currentLang === 'fr';
        this.tabs = isFrench
            ? [FRIENDS_FR.discover, FRIENDS_FR.friends, FRIENDS_FR.friendRequest]
            : [FRIENDS_EN.discover, FRIENDS_EN.friends, FRIENDS_EN.friendRequest];
    }

    switchTab(tab: FriendTab): void {
        this.currentTab = tab;
        this.refreshFilteredLists();
    }

    // Search is applied reactively by the facade's view-model stream.
    onSearchInput(): void {
        this.resetPaginationForCurrentTab();
        this.friendsFacadeService.setSearchTerm(this.searchTerm);
    }

    clearSearch(): void {
        this.searchTerm = '';
        this.resetPaginationForCurrentTab();
        this.friendsFacadeService.setSearchTerm(this.searchTerm);
    }

    // Legacy UI hook kept for tab changes after moving filtering to the facade stream.
    refreshFilteredLists(): void {
        this.resetPaginationForCurrentTab();
        this.friendsFacadeService.setSearchTerm(this.searchTerm);
    }

    getFilteredList(): AccountFriend[] {
        if (this.currentTab === FriendTab.Discover) {
            return this.filteredDiscoverList;
        }
        if (this.currentTab === FriendTab.Friends) {
            return this.filteredFriendsList;
        }
        return [];
    }

    getRequestForUser(userId: string) {
        return this.friendsFacadeService.getRequestForUser(userId);
    }

    canGoToPreviousPage(tab: FriendTab): boolean {
        return this.pageByTab[tab] > 0;
    }

    canGoToNextPage(tab: FriendTab): boolean {
        const totalPages = this.getTotalPages(tab);
        return this.pageByTab[tab] < totalPages - 1;
    }

    goToPreviousPage(tab: FriendTab): void {
        this.pageByTab[tab] = Math.max(0, this.pageByTab[tab] - 1);
        this.updatePagedLists();
    }

    goToNextPage(tab: FriendTab): void {
        const totalPages = this.getTotalPages(tab);
        this.pageByTab[tab] = Math.min(totalPages - 1, this.pageByTab[tab] + 1);
        this.updatePagedLists();
    }

    shouldShowPager(tab: FriendTab): boolean {
        return this.getListLength(tab) > this.pageSize;
    }

    getPaginationRangeLabel(tab: FriendTab): string {
        const total = this.getListLength(tab);
        if (total === 0) {
            return '0';
        }
        const start = this.pageByTab[tab] * this.pageSize + 1;
        const end = Math.min(start + this.pageSize - 1, total);
        return `${start}-${end} of ${total}`;
    }

    getOfflineElapsedLabel(account: AccountFriend): string {
        const lastSeenDate = this.parseTimestamp(account.lastSeenAt);
        if (!lastSeenDate) {
            return '1m';
        }
        return this.formatRelativeTimeCompact(lastSeenDate);
    }

    // Command handlers: each intent delegates to facade + optionally asks confirmation.
    sendFriendRequest(userId: string): void {
        this.friendsFacadeService.sendFriendRequest(userId).subscribe(() => {
            this.friendsFacadeService.setSearchTerm(this.searchTerm);
        });
    }

    cancelFriendRequest(receiverId: string, pseudonym: string): void {
        const dialogMessage =
            this.translateService.currentLang === 'fr'
                ? `annuler la demande d'ami envoyée à ${pseudonym}`
                : `cancel the friend request sent to ${pseudonym}`;

        this.cancelConfirmationService.askConfirmation(() => {
            this.friendsFacadeService.cancelFriendRequest(receiverId).subscribe(() => {
                this.friendsFacadeService.setSearchTerm(this.searchTerm);
            });
        }, dialogMessage);
    }

    acceptFriendRequest(requestId: string): void {
        this.friendsFacadeService.acceptFriendRequest(requestId).subscribe(() => {
            this.friendsFacadeService.setSearchTerm(this.searchTerm);
        });
    }

    rejectFriendRequest(requestId: string): void {
        this.friendsFacadeService.rejectFriendRequest(requestId).subscribe(() => {
            this.friendsFacadeService.setSearchTerm(this.searchTerm);
        });
    }

    removeFriend(friendId: string, pseudonym: string): void {
        const dialogMessage =
            this.translateService.currentLang === 'fr'
                ? `retirer ${pseudonym} de vos amis`
                : `remove ${pseudonym} from your friends`;

        this.cancelConfirmationService.askConfirmation(() => {
            this.friendsFacadeService.removeFriend(friendId).subscribe(() => {
                this.friendsFacadeService.setSearchTerm(this.searchTerm);
            });
        }, dialogMessage);
    }

    blockNormalUser(blockedUserId: string, pseudonym: string): void {
        const dialogMessage =
            this.translateService.currentLang === 'fr'
                ? `bloquer ${pseudonym}`
                : `block ${pseudonym}`;

        this.cancelConfirmationService.askConfirmation(() => {
            this.friendsFacadeService.blockNormalUser(blockedUserId).subscribe(() => {
                this.friendsFacadeService.setSearchTerm(this.searchTerm);
            });
        }, dialogMessage);
    }

    blockFriend(blockedFriendId: string, pseudonym: string): void {
        const dialogMessage =
            this.translateService.currentLang === 'fr'
                ? `bloquer votre ami ${pseudonym}`
                : `block your friend ${pseudonym}`;

        this.cancelConfirmationService.askConfirmation(() => {
            this.friendsFacadeService.blockFriend(blockedFriendId).subscribe(() => {
                this.friendsFacadeService.setSearchTerm(this.searchTerm);
            });
        }, dialogMessage);
    }

    blockUserWithPendingRequest(otherUserId: string, pseudonym: string): void {
        const dialogMessage =
            this.translateService.currentLang === 'fr'
                ? `bloquer ${pseudonym}`
                : `block ${pseudonym}`;

        this.cancelConfirmationService.askConfirmation(() => {
            this.friendsFacadeService.blockUserWithPendingRequest(otherUserId).subscribe(() => {
                this.friendsFacadeService.setSearchTerm(this.searchTerm);
            });
        }, dialogMessage);
    }

    unblockUser(blockedUserId: string, pseudonym: string): void {
        const dialogMessage =
            this.translateService.currentLang === 'fr'
                ? `débloquer ${pseudonym}`
                : `unblock ${pseudonym}`;

        this.cancelConfirmationService.askConfirmation(() => {
            this.friendsFacadeService.unblockUser(blockedUserId).subscribe(() => {
                this.friendsFacadeService.setSearchTerm(this.searchTerm);
            });
        }, dialogMessage);
    }

    // Centralized assignment from reactive VM to component fields used by template.
    private applyViewModel(viewModel: FriendsViewModel): void {
        this.filteredDiscoverList = viewModel.discoverList;
        this.filteredFriendsList = viewModel.friendsList;
        this.blockedUsersList = viewModel.blockedList;
        this.friendRequestsList = viewModel.requestList;
        this.friendCount = viewModel.friendCount;
        this.requestCount = viewModel.requestCount;
        this.blockedCount = viewModel.blockedCount;
        this.clampPageIndexes();
        this.updatePagedLists();
    }

    private resetPaginationForCurrentTab(): void {
        this.pageByTab[this.currentTab] = 0;
        this.updatePagedLists();
    }

    private getListLength(tab: FriendTab): number {
        if (tab === FriendTab.Discover) {
            return this.filteredDiscoverList.length;
        }
        if (tab === FriendTab.Friends) {
            return this.filteredFriendsList.length;
        }
        if (tab === FriendTab.Requests) {
            return this.friendRequestsList.length;
        }
        return this.blockedUsersList.length;
    }

    private getTotalPages(tab: FriendTab): number {
        const listLength = this.getListLength(tab);
        return Math.max(1, Math.ceil(listLength / this.pageSize));
    }

    private clampPageIndexes(): void {
        const tabs = [FriendTab.Discover, FriendTab.Friends, FriendTab.Requests, FriendTab.Blocked];
        tabs.forEach((tab) => {
            const maxPageIndex = this.getTotalPages(tab) - 1;
            this.pageByTab[tab] = Math.min(this.pageByTab[tab], maxPageIndex);
        });
    }

    private getPageSlice<T>(items: T[], tab: FriendTab): T[] {
        const start = this.pageByTab[tab] * this.pageSize;
        return items.slice(start, start + this.pageSize);
    }

    private updatePagedLists(): void {
        this.pagedDiscoverList = this.getPageSlice(this.filteredDiscoverList, FriendTab.Discover);
        this.pagedFriendsList = this.getPageSlice(this.filteredFriendsList, FriendTab.Friends);
        this.pagedBlockedUsersList = this.getPageSlice(this.blockedUsersList, FriendTab.Blocked);
        this.pagedFriendRequestsList = this.getPageSlice(this.friendRequestsList, FriendTab.Requests);
    }

    private parseTimestamp(rawValue: string | null): Date | null {
        if (!rawValue) {
            return null;
        }
        const parsed = new Date(rawValue);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }

        const match = rawValue.match(/^(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})(?:\s*(AM|PM))?$/i);
        if (!match) {
            return null;
        }

        const month = Number(match[1]);
        const day = Number(match[2]);
        const year = Number(match[3]);
        let hours = Number(match[4]);
        const minutes = Number(match[5]);
        const seconds = Number(match[6]);
        const meridiem = match[7]?.toUpperCase();

        if (meridiem === 'PM' && hours < 12) {
            hours += 12;
        } else if (meridiem === 'AM' && hours === 12) {
            hours = 0;
        }

        return new Date(year, month - 1, day, hours, minutes, seconds);
    }

    private formatRelativeTimeCompact(lastSeenDate: Date): string {
        const elapsedMs = Date.now() - lastSeenDate.getTime();
        const safeElapsedMs = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
        const elapsedMinutes = Math.floor(safeElapsedMs / 60000);
        const isFrench = this.translateService.currentLang === 'fr';

        if (elapsedMinutes < 1) {
            return '1m';
        }
        if (elapsedMinutes < 60) {
            return `${elapsedMinutes}m`;
        }
        const elapsedHours = Math.floor(elapsedMinutes / 60);
        if (elapsedHours < 24) {
            return `${elapsedHours}h`;
        }
        const elapsedDays = Math.floor(elapsedHours / 24);
        return `${elapsedDays}${isFrench ? 'j' : 'd'}`;
    }
}
