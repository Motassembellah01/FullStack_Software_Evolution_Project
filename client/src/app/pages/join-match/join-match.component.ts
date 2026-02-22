import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterModule } from '@angular/router';
import { CurrentMatchesDto } from '@app/core/classes/match/dto/current-matches.dto';
import { JoinMatchObserverDto } from '@app/core/classes/match/dto/join-match-observer.dto';
import { JoinedMatchObserverDto } from '@app/core/classes/match/dto/joined-match-observer.dto';
import { NewPlayerDto } from '@app/core/classes/match/dto/new-player.dto';
import { Match } from '@app/core/classes/match/match';
import { SocketsOnEvents, SocketsSendEvents } from '@app/core/constants/constants';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { MatchCommunicationService } from '@app/core/http/services/match-communication/match-communication.service';
import { PlayerRequest } from '@app/core/interfaces/player-request';
import { AccountListenerService } from '@app/core/services/account-listener/account-listener.service';
import { HistogramService } from '@app/core/services/histogram-service/histogram.service';
import { JoinMatchService } from '@app/core/services/join-match/join-match.service';
import { MatchPlayerService } from '@app/core/services/match-player-service/match-player.service';
import { SocketService } from '@app/core/websocket/services/socket-service/socket.service';
import { AppMaterialModule } from '@app/modules/material.module';
import { ErrorMessageComponent } from '@app/shared/components/error-message/error-message.component';
import { LoginComponent } from '@app/shared/components/login/login.component';
import { LogoComponent } from '@app/shared/components/logo/logo.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LocalizedFieldPipe } from '@app/shared/pipes/localized-field.pipe';
import { map, forkJoin, firstValueFrom, of } from 'rxjs';

export interface OngoingGames {
    name: string;
    playersCount: number;
    quizName: string;
    observersCount: number;
}

export interface WaitingGames {
    name: string;
    playersCount: number;
    quizName: string;
    isLocked: boolean;
    accessCode: string;
}

@Component({
    selector: 'app-join-match',
    templateUrl: './join-match.component.html',
    styleUrls: ['./join-match.component.scss'],
    standalone: true,
    imports: [AppMaterialModule, LogoComponent, LoginComponent, CommonModule, FormsModule, ErrorMessageComponent, RouterModule, TranslateModule, LocalizedFieldPipe],
})
export class JoinMatchComponent implements OnInit, OnDestroy {
    accessCodeError: boolean = false;
    errorMessage: string = '';
    accessCode: string = '';
    maxAccessCodeLength: number = 4;
    currentMatches: CurrentMatchesDto[] = [];
    isLoading: boolean = true;

    @ViewChild('certitudeToEnterGame') certitudeToEnterGame!: TemplateRef<any>;
    @ViewChild('confirmJoinMatchDialog') confirmJoinMatchDialog!: TemplateRef<any>;
    @ViewChild('insufficientFundsDialog') insufficientFundsDialog!: TemplateRef<any>;

    constructor(
        private dialog: MatDialog,
        private router: Router,
        public matchPlayerService: MatchPlayerService,
        private readonly matchCommunicationService: MatchCommunicationService,
        public accountService: AccountService,
        private readonly socketService: SocketService,
        private histogramService: HistogramService,
        public joinMatchService: JoinMatchService,
        public accountListenerService: AccountListenerService,
        private translateService: TranslateService,
    ) {}

    clearError(): void {
        if (this.accessCodeError) {
            this.accessCodeError = false;
            this.errorMessage = '';
        }
    }

    @HostListener('window:keydown.enter', ['$event'])
    onEnterKey(): void {
        this.onJoinMatch();
    }

    ngOnInit(): void {
        this.matchPlayerService.cleanCurrentMatch();
        this.refreshGames().then(() => {
            this.isLoading = false;
        });

        this.socketService.on<JoinedMatchObserverDto>(SocketsOnEvents.JoinedMatchObserver, (joinedMatchObserverDto) => {
            if (joinedMatchObserverDto.addedObserverName === this.accountService.account.pseudonym) {
                this.accountService.isInGame = true;
                this.matchPlayerService.setCurrentMatch(
                    new Match(joinedMatchObserverDto.match),
                    {
                        name: joinedMatchObserverDto.match.managerName,
                        isActive: true,
                        score: 0,
                        nBonusObtained: 0,
                        chatBlocked: false,
                        avatar: ''
                    },
                );
                this.router.navigateByUrl(`/play/manager/match/${joinedMatchObserverDto.match.game.id}`);
            } else {
                this.matchPlayerService.match.observers = joinedMatchObserverDto.match.observers;
            }
        });

        this.socketService.on(SocketsOnEvents.MatchListUpdated, () => {
            this.refreshGames();
        });
    }

    ngOnDestroy(): void {
        this.socketService.removeListener(SocketsOnEvents.MatchListUpdated);
    }

    async refreshGames() {
        return new Promise<void>((resolve) => {
            this.matchCommunicationService.getAllMatches().subscribe((matches: CurrentMatchesDto[]) => {
                this.currentMatches = matches;
                resolve();
            });
        });
    }

    organiserIsFriend(managerId: string): boolean {
        return this.accountListenerService.friends.includes(managerId);
    }

    async getForbidenCodes(): Promise<string[]> {
        await this.refreshGames();

        const firstForbiddenList = this.currentMatches
            .filter(match => !this.organiserIsFriend(match.managerId) && match.isFriendMatch)
            .map(match => match.accessCode);

        const secondForbiddenList = await firstValueFrom(
            forkJoin(
                this.currentMatches.map(match =>
                    (match.players.length > 0
                        ? forkJoin(
                              match.players.map(player =>
                                  this.accountService.getAccountByPseudonym(player.name).pipe(
                                      map(account => account.userId)
                                  )
                              )
                          )
                        : of([])
                    ).pipe(
                        map(userIds =>
                            userIds.some(userId => this.accountListenerService.UsersBlockingMe.includes(userId)) ? match.accessCode : null
                        )
                    )
                )
            ).pipe(
                map(results => results.filter(code => code !== null))
            )
        ).then(results => results.filter((code): code is string => code !== null));

        return [...firstForbiddenList, ...secondForbiddenList];
    }

    getWaitingGames() {
        return this.currentMatches.filter((match) =>
            !match.hasStarted && (!match.isFriendMatch || this.organiserIsFriend(match.managerId))
        ) || [];
    }

    getOnGoingGames() {
        return this.currentMatches.filter((match) =>
            match.hasStarted && (!match.isFriendMatch || this.organiserIsFriend(match.managerId))
        ) || [];
    }

    async onJoinMatch(): Promise<void> {
        await this.refreshGames();

        if (this.accessCode.trim() === '') {
            this.accessCodeError = true;
            this.errorMessage = this.translateService.instant('JOIN_MATCH.ERROR_EMPTY_CODE');
            return;
        }

        if ((await this.getForbidenCodes()).includes(this.accessCode)) {
            this.accessCodeError = true;
            this.errorMessage = this.translateService.instant('JOIN_MATCH.ERROR_FORBIDDEN');
            return;
        }

        const matchInAll = this.currentMatches.find((m) => m.accessCode === this.accessCode);

        if (!matchInAll) {
            this.accessCodeError = true;
            this.errorMessage = this.translateService.instant('JOIN_MATCH.ERROR_NOT_FOUND');
            return;
        }

        if (matchInAll.hasStarted) {
            this.accessCodeError = true;
            this.errorMessage = this.translateService.instant('JOIN_MATCH.ERROR_ALREADY_STARTED');
            return;
        }

        if (!matchInAll.isAccessible) {
            this.accessCodeError = true;
            this.errorMessage = this.translateService.instant('JOIN_MATCH.ERROR_LOCKED');
            return;
        }

        const match = matchInAll;

        if (match.isPricedMatch) {
            const newMoney = this.accountService.money - match.priceMatch;
            if (newMoney < 0) {
                this.openInsufficientFundsDialog();
                return;
            }
            const dialogRef = this.dialog.open(this.confirmJoinMatchDialog);

            dialogRef.afterClosed().subscribe((result) => {
                if (result === 'confirm') {
                    this.matchCommunicationService.joinMatch(this.accessCode, this.accountService.account.pseudonym).subscribe({
                        next: () => {
                            this.handleSuccessfulJoin(this.accessCode);
                        },
                    });
                }
            });
        } else {
            this.matchCommunicationService.joinMatch(this.accessCode, this.accountService.account.pseudonym).subscribe({
                next: () => {
                    this.handleSuccessfulJoin(this.accessCode);
                },
            });
        }
    }

    openInsufficientFundsDialog(): void {
        this.dialog.open(this.insufficientFundsDialog);
    }

    async joinGame(accessCode: string): Promise<void> {
        if ((await this.getForbidenCodes()).includes(accessCode)) {
            this.accessCodeError = true;
            this.errorMessage = this.translateService.instant('JOIN_MATCH.ERROR_FORBIDDEN');
            return;
        }

        const match = this.currentMatches.find((m) => m.accessCode === accessCode);

        if (!match) {
            console.error("Match not found with the given accessCode");
            return;
        }

        if (match.isPricedMatch) {
            const newMoney = this.accountService.money - match.priceMatch;
            if (newMoney < 0) {
                this.openInsufficientFundsDialog();
                return;
            }
            const dialogRef = this.dialog.open(this.confirmJoinMatchDialog);

            dialogRef.afterClosed().subscribe((result) => {
                if (result === 'confirm') {
                    this.matchCommunicationService.joinMatch(accessCode, this.accountService.account.pseudonym).subscribe({
                        next: () => {
                            this.handleSuccessfulJoin(accessCode);
                        },
                    });
                }
            });
        } else {
            this.matchCommunicationService.joinMatch(accessCode, this.accountService.account.pseudonym).subscribe({
                next: () => {
                    this.handleSuccessfulJoin(accessCode);
                },
            });
        }
    }

    async joinAsObserver(accessCode: string): Promise<void> {
        if ((await this.getForbidenCodes()).includes(accessCode)) {
            this.accessCodeError = true;
            this.errorMessage = this.translateService.instant('JOIN_MATCH.ERROR_FORBIDDEN_OBSERVER');
            return;
        }
        this.socketService.send<JoinMatchObserverDto>(SocketsSendEvents.JoinMatchObserver, { accessCode, name: this.accountService.account.pseudonym });
    }

    private handleSuccessfulJoin(accessCode: string): void {
        this.histogramService.resetAttributes();
        this.matchPlayerService.cleanCurrentMatch();

        this.joinMatchService.playerName = this.accountService.account.pseudonym;
        this.accountService.isInGame = true;
        const match = this.currentMatches.find((m) => m.accessCode === accessCode);

        this.socketService.on<NewPlayerDto>(SocketsOnEvents.NewPlayer, (newPlayerDto) => {
            this.matchPlayerService.match.accessCode = accessCode;
            this.matchPlayerService.match.players = newPlayerDto.players;
            this.matchPlayerService.match.isTeamMatch = newPlayerDto.isTeamMatch;
            this.matchPlayerService.match.isPricedMatch = newPlayerDto.isPricedMatch;
            this.matchPlayerService.match.priceMatch = newPlayerDto.priceMatch;
            this.matchPlayerService.match.nbPlayersJoined = newPlayerDto.nbPlayersJoined;
            this.matchPlayerService.match.teams = newPlayerDto.teams;
            this.router.navigateByUrl(`play/wait/${accessCode}`);
        });

        if (match) {
            if (match.isPricedMatch) {
                this.accountService.updateMoney(this.accountService.money - match.priceMatch).subscribe((updatedMoneyAccount) => {
                    this.accountService.money = updatedMoneyAccount.money;
                });
            }
        }

        this.socketService.send<PlayerRequest>(SocketsSendEvents.JoinMatch, {
            roomId: accessCode,
            name: this.accountService.account.pseudonym,
        });
    }
}
