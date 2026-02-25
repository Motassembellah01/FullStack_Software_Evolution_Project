import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { GeneralChatService } from '@app/core/services/general-chat-service/general-chat.service';
import { Language } from './core/constants/constants';
import { AccountService } from './core/http/services/account-service/account.service';
import { Account } from './core/interfaces/account/account';
import { AuthService } from './core/services/auth-service/auth.service';
import { TranslationService } from './core/services/translate-service/translate.service';
import { HeaderComponent } from './shared/components/header/header.component';
import { FriendService } from './core/http/services/friend-service/friend.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: true,
    imports: [RouterOutlet, HeaderComponent, CommonModule],
})
export class AppComponent implements OnInit {
    showHeader: boolean = true;
    showBackground: boolean = true;
    constructor(
        public accountService: AccountService,
        public auth: AuthService,
        private readonly translationService: TranslationService,
        private readonly router: Router,
        private generalChatService: GeneralChatService,
        private friendService: FriendService
    ) {}

    get isHeaderVisible(): boolean {
        return this.showHeader && !!this.accountService.account && !!this.accountService.account.avatarUrl;
    }

    get isSectionOpen(): boolean {
        return (
            (this.generalChatService.isChatOpen && !this.generalChatService.isChatClosed) ||
            this.generalChatService.isFriendsOpen ||
            this.generalChatService.isProfileOpen || this.generalChatService.isShopOpen
            || this.generalChatService.isSettingsOpen
        );
    }

    get shouldApplyHeaderOffset(): boolean {
        const currentUrl = this.router.url;
        const seamlessRoutes = ['/home', '/login-fail', '/create'];
        return !seamlessRoutes.includes(currentUrl) && !currentUrl.startsWith('/administration');
    }

    ngOnInit(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isChat: boolean = (window as any).chatAPI?.isChatProcess();
        if (isChat) {
            this.router.navigateByUrl('/chat');
        }
        this.updateHeaderVisibility();
        this.updateMainVisibility();

        (window as any).electronAPI.getProfile().then((profile: any) => {
            if (!profile) {
                this.router.navigateByUrl('/login-fail');
                return;
            }
            this.accountService.auth0Id = profile.sub;
            this.friendService.auth0Id = profile.sub;
            this.accountService.getAccount().subscribe((account: Account) => {
                this.accountService.account = account;
                if (!account) {
                    this.translationService.changeLang(Language.EN);
                    return;
                }
                this.accountService.createSession().subscribe();
                if (!account.avatarUrl) {
                    this.translationService.changeLang(Language.EN);
                    this.router.navigateByUrl('/set-avatar');
                    return;
                }
                this.translationService.changeLang(account.lang || Language.EN);
            });
        });
    }

    private updateHeaderVisibility() {
        this.router.events.subscribe(() => {
            this.showHeader = this.router.url !== '/chat';
        });
    }

    private updateMainVisibility() {
        this.router.events.subscribe(() => {
            this.showBackground = this.router.url !== '/home' && this.router.url !== '/login-fail';
        });
    }
}
