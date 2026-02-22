import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { CreateTeamDto } from '@app/core/classes/match/dto/create-team.dto';
import { JoinedMatchObserverDto } from '@app/core/classes/match/dto/joined-match-observer.dto';
import { UpdateScoreDto } from '@app/core/classes/match/dto/update-score.dto';
import { Match } from '@app/core/classes/match/match';
import { Observer } from '@app/core/classes/match/observer';
import {
    DIALOG_MESSAGE_EN,
    DIALOG_MESSAGE_FR,
    SocketsOnEvents,
    SocketsSendEvents,
    TRANSITIONS_DURATIONS,
    TRANSITIONS_MESSAGES_EN,
    TRANSITIONS_MESSAGES_FR
} from '@app/core/constants/constants';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { PlayerRequest } from '@app/core/interfaces/player-request';
import { CancelConfirmationService } from '@app/core/services/cancel-confirmation/cancel-confirmation.service';
import { DialogTransitionService } from '@app/core/services/dialog-transition-service/dialog-transition.service';
import { MatchPlayerService } from '@app/core/services/match-player-service/match-player.service';
import { ListenerManagerService } from '@app/core/websocket/services/listener-manager/listener-manager.service';
import { SocketService } from '@app/core/websocket/services/socket-service/socket.service';
// import { SocketService } from '@app/core/websocket/services/socket-service/socket.service';
import { AppMaterialModule } from '@app/modules/material.module';
import { AlertDialogComponent } from '@app/shared/alert-dialog/alert-dialog.component';
import { LogoComponent } from '@app/shared/components/logo/logo.component';
import { PlayerCardComponent } from '@app/shared/components/player-card/player-card.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

/**
 * Player waiting room component.
 * This component allows players to join the waiting room using an access code.
 * It displays the list of present players and allows the player to leave the room.
 * It also listens for real-time updates through a WebSocket service.
 */

@Component({
    selector: 'app-waiting-room',
    templateUrl: './waiting-room.component.html',
    styleUrls: ['./waiting-room.component.scss'],
    standalone: true,
    imports: [AppMaterialModule, LogoComponent, PlayerCardComponent, CommonModule, TranslateModule, FormsModule],
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
    waitingRoomIsLocked: boolean = true;
    errorMessage: string = '';
    isCreatingTeam: boolean = false;
    newTeamName: string = '';

    // eslint-disable-next-line max-params
    constructor(
        public matchSrv: MatchPlayerService,
        public confirmationService: CancelConfirmationService,
        private listenerService: ListenerManagerService,
        private transitionDialogService: DialogTransitionService,
        public accountService: AccountService,
        private translateService: TranslateService,
        private readonly socketService: SocketService,
        private dialog: MatDialog
    ) {}

    ngOnInit(): void {
        this.connect();
        this.matchSrv.setupListenersPLayerView();
        window.onbeforeunload = () => {
            this.abandonGameWithoutConfirmation();
        };
        window.onpopstate = () => {
            this.abandonGameWithoutConfirmation();
        };
    }

    ngOnDestroy(): void {
        window.onbeforeunload = () => {
            return;
        };
        window.onpopstate = () => {
            return;
        };
    }

    abandonGameWithoutConfirmation(): void {
        this.matchSrv.socketService.send<PlayerRequest>(SocketsSendEvents.RemovePlayer, {
            roomId: this.matchSrv.match.accessCode,
            name: this.accountService.account.pseudonym,
            hasPlayerLeft: true,
        });
    }

    abandonGame(): void {
        let dialogMessage;
        if (this.translateService.currentLang === 'fr') {
            dialogMessage = DIALOG_MESSAGE_FR.quitMatch;
        } else {
            dialogMessage = DIALOG_MESSAGE_EN.quitMatch;
        }

        this.confirmationService.askConfirmation(this.abandonGameWithoutConfirmation.bind(this), dialogMessage);
    }

    connect(): void {
        this.matchSrv.socketService.connect();
        this.setupListeners();
    }

    setMatchInformations(match: Match): void {
        this.matchSrv.setCurrentMatch(Match.parseMatch(match), {
            name: this.accountService.account.pseudonym,
            isActive: true,
            score: 0,
            nBonusObtained: 0,
            chatBlocked: false,
            avatar: this.accountService.getLocalAvatar(this.accountService.account.avatarUrl),
        });
        this.matchSrv.match.players = match.players;
        this.matchSrv.initializeScore();
    }

    setTransitionToMatchView(): void {
        const transitionMessage =
            this.translateService.currentLang === 'fr' ? TRANSITIONS_MESSAGES_FR.beginMatch : TRANSITIONS_MESSAGES_EN.beginMatch;

        this.transitionDialogService.openTransitionDialog(transitionMessage, TRANSITIONS_DURATIONS.startOfTheGame);
        this.matchSrv.timeService.startTimer(TRANSITIONS_DURATIONS.startOfTheGame, this.matchSrv.match.accessCode, () => {
            this.transitionDialogService.closeTransitionDialog();
            this.matchSrv.router.navigateByUrl(`/play/match/${this.matchSrv.match.game.id}`);
        });
    }

    quitCanceledGame(): void {
        this.confirmationService.dialogRef?.close();
        this.dialog.open(AlertDialogComponent, {
            data: {
                title: "ERROR_MESSAGE_FOR.GAME_CANCELLED",
                messages: []
            }
        })
        this.transitionDialogService.closeTransitionDialog();
        this.matchSrv.cleanMatchListeners();
        this.matchSrv.router.navigateByUrl('/home');
        this.accountService.isInGame = false;
    }

    setupListeners(): void {
        this.listenerService.setWaitingRoomListeners();
        this.matchSrv.socketService.on<Match>(SocketsOnEvents.JoinBegunMatch, (match: Match) => {
            this.setMatchInformations(match);
            this.setTransitionToMatchView();
        });

        this.socketService.on<JoinedMatchObserverDto>(SocketsOnEvents.JoinedMatchObserver, (joinedMatchObserverDto) => {
            this.matchSrv.match.observers = joinedMatchObserverDto.match.observers;
        });

        this.matchSrv.socketService.on<Observer[]>(SocketsOnEvents.ObserverRemoved, (observers: Observer[]) => {
            if (this.matchSrv.isObserver()) {
                this.matchSrv.cleanCurrentMatch();
                this.matchSrv.router.navigateByUrl('/home');
            } else {
                this.matchSrv.match.observers = observers;
            }
        });

        this.matchSrv.socketService.on<void>(SocketsOnEvents.GameCanceled, () => {
            this.quitCanceledGame();
        });


        this.matchSrv.socketService.on<string>(SocketsOnEvents.SendWinnerName, (winnerName) => {
            this.accountService.isWinnerPlayerName = this.accountService.account.pseudonym === winnerName;
            this.accountService.getAccount().subscribe((account) => {
                this.accountService.account = account;
                this.accountService.money = account.money;
            });
        });

        this.matchSrv.socketService.on<UpdateScoreDto>(SocketsOnEvents.UpdatedScore, (updateScoreDto) => {
            this.matchSrv.match.teams = updateScoreDto.teams;
            if (this.accountService.account.pseudonym === updateScoreDto.player.name) {
                this.matchSrv.updatePlayerScore(updateScoreDto.player);
            }
            this.matchSrv.match.updatePlayerStats(updateScoreDto.player);
        });
    }

    joinTeam(teamName: string): void {
        this.socketService.send<CreateTeamDto>(SocketsSendEvents.JoinTeam, {
            accessCode: this.matchSrv.match.accessCode,
            teamName: teamName,
            playerName: this.accountService.account.pseudonym
        });
    }

    leaveTeam(teamName: string): void {
        this.socketService.send<CreateTeamDto>(SocketsSendEvents.QuitTeam, {
            accessCode: this.matchSrv.match.accessCode,
            teamName: teamName,
            playerName: this.accountService.account.pseudonym
        });
    }

    openTeamCreationDialog(): void {
        this.isCreatingTeam = true;
    }

    cancelTeamCreation(): void {
        this.isCreatingTeam = false;
        this.newTeamName = '';
        this.errorMessage = '';
    }

    getCurrentPlayerTeam() {
        return this.matchSrv.match.teams.find(team =>
            team.players.some(player => player === this.accountService.account.pseudonym)
        )?.name;
    }


    createTeam(teamName: string): void {
        if (teamName.trim() !== '' && !this.matchSrv.match.teams?.some((team) => team.name === teamName)) {
            this.socketService.send<CreateTeamDto>(SocketsSendEvents.CreateTeam, {
                accessCode: this.matchSrv.match.accessCode,
                teamName: teamName,
                playerName: this.accountService.account.pseudonym
            });
            this.cancelTeamCreation();
        } else {
            this.errorMessage = 'Team name invalid or already used';
        }
    }
}
