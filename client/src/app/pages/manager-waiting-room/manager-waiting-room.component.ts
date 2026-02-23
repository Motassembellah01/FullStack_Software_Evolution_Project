import { ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { JoinedMatchObserverDto } from '@app/core/classes/match/dto/joined-match-observer.dto';
import { Match } from '@app/core/classes/match/match';
import {
    DIALOG_MESSAGE_EN,
    DIALOG_MESSAGE_FR,
    SocketsOnEvents,
    SocketsSendEvents,
    TRANSITIONS_DURATIONS,
    TRANSITIONS_MESSAGES_EN,
    TRANSITIONS_MESSAGES_FR,
} from '@app/core/constants/constants';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { Room } from '@app/core/interfaces/room';
import { CancelConfirmationService } from '@app/core/services/cancel-confirmation/cancel-confirmation.service';
import { DialogTransitionService } from '@app/core/services/dialog-transition-service/dialog-transition.service';
import { MatchPlayerService } from '@app/core/services/match-player-service/match-player.service';
import { ListenerManagerService } from '@app/core/websocket/services/listener-manager/listener-manager.service';
import { AppMaterialModule } from '@app/modules/material.module';
import { LogoComponent } from '@app/shared/components/logo/logo.component';
import { PlayerCardComponent } from '@app/shared/components/player-card/player-card.component';
import { TransitionDialogComponent } from '@app/shared/components/transition-dialog/transition-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { timer } from 'rxjs';

/**
 * Manager waiting room component.
 * This component allows the manager to manage the waiting room before the game starts.
 * It provides features like locking/unlocking the room and starting the game.
 * It also listens for real-time updates through a WebSocket service.
 */
@Component({
    selector: 'app-manager-waiting-room',
    templateUrl: './manager-waiting-room.component.html',
    styleUrls: ['./manager-waiting-room.component.scss'],
    standalone: true,
    imports: [AppMaterialModule, LogoComponent, PlayerCardComponent, CommonModule, ClipboardModule, TranslateModule],
})
export class ManagerWaitingRoomComponent implements OnInit, OnDestroy {
    waitingRoomIsLocked: boolean = false;
    accessCode: string = this.matchSrv.match.accessCode;
    accessCodeDigits: string[] = this.matchSrv.match.accessCode.split('');
    nextQuestionButtonText = 'Prochaine question';
    dialogRef: MatDialogRef<TransitionDialogComponent>;
    isCopied: boolean = false;
    ONE_SECOND_DELAY: number = 1000;
    particles = Array.from({ length: 30 }, () => ({
        x: Math.random() * 100,
        delay: Math.random() * 6,
        duration: 6 + Math.random() * 6,
    }));
    // eslint-disable-next-line max-params
    constructor(
        public matchSrv: MatchPlayerService,
        public dialog: MatDialog,
        private listenerService: ListenerManagerService,
        private confirmationService: CancelConfirmationService,
        private dialogTransitionService: DialogTransitionService,
        private translateService: TranslateService,
        public accountService: AccountService
    ) {}

    ngOnInit(): void {
        this.connect();
        this.matchSrv.joinMatchRoom(this.accessCode);
        window.onbeforeunload = () => {
            this.cancelGameWithoutConfirmation();
        };
        window.onpopstate = () => {
            this.cancelGameWithoutConfirmation();
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

    onLockWaitingRoom(): void {
        this.waitingRoomIsLocked = !this.waitingRoomIsLocked;
        this.matchSrv.setAccessibility().subscribe();
    }

    cancelGameWithoutConfirmation(): void {
        this.matchSrv.socketService.send<Room>(SocketsSendEvents.CancelGame, { id: this.accessCode });
        this.matchSrv.timeService.stopServerTimer(this.matchSrv.match.accessCode);
        this.matchSrv.deleteMatchByAccessCode(this.matchSrv.match.accessCode).subscribe();
        this.matchSrv.router.navigateByUrl(`/create/preview/games/${this.matchSrv.match.game.id}`);
        this.matchSrv.cleanCurrentMatch();
    }
    cancelGame(): void {
        let dialogMessage;
        if (this.translateService.currentLang === 'fr') {
            dialogMessage = DIALOG_MESSAGE_FR.cancelMatch;
        } else {
            dialogMessage = DIALOG_MESSAGE_EN.cancelMatch;
        }

        this.confirmationService.askConfirmation(this.cancelGameWithoutConfirmation.bind(this), dialogMessage);
    }

    areAllTeamsValid() {
        if (!this.matchSrv.match.isTeamMatch) return true;

        const teams = this.matchSrv.match.teams.filter((team) => team.players.length > 0);

        const hasValidTeams =
            teams?.every((team) => team.players.length === 2) &&
            teams?.reduce((count, team) => count + team.players.length, 0) === this.matchSrv.match.players.length;
        return hasValidTeams;
    }

    onBeginMatch(): void {
        this.matchSrv.socketService.send<Room>(SocketsSendEvents.BeginMatch, { id: this.accessCode });
        if (this.translateService.currentLang === 'fr')
            this.dialogTransitionService.openTransitionDialog(TRANSITIONS_MESSAGES_FR.beginMatch, TRANSITIONS_DURATIONS.startOfTheGame);
        if (this.translateService.currentLang === 'en')
            this.dialogTransitionService.openTransitionDialog(TRANSITIONS_MESSAGES_EN.beginMatch, TRANSITIONS_DURATIONS.startOfTheGame);
        this.matchSrv.timeService.startTimer(TRANSITIONS_DURATIONS.startOfTheGame, this.accessCode, () => {
            this.dialogTransitionService.closeTransitionDialog();
            this.matchSrv.router.navigateByUrl(`/play/manager/match/${this.matchSrv.match.game.id}`);
        });
    }

    connect(): void {
        this.matchSrv.socketService.connect();
        this.setupListeners();
        this.matchSrv.socketService.on<JoinedMatchObserverDto>(SocketsOnEvents.JoinedMatchObserver, (joinedMatchObserverDto) => {
            this.matchSrv.match.observers = joinedMatchObserverDto.match.observers;
        });
    }

    setupListeners(): void {
        this.listenerService.setManagerWaitingRoomListeners();
        this.matchSrv.socketService.on<Match>(SocketsOnEvents.JoinBegunMatch, (match: Match) => {
            this.matchSrv.match.teams = match.teams;
        });
    }

    copyCode() {
        this.isCopied = true;
        timer(this.ONE_SECOND_DELAY).subscribe(() => {
            this.isCopied = false;
        });
    }

    getTranslationLock(): string {
        return this.waitingRoomIsLocked ? 'NAV_BUTTONS.UNLOCK' : 'NAV_BUTTONS.LOCK';
    }

    isMinPlayersConditionValid() {
        if (!this.matchSrv.match.isTeamMatch) return true;
        return this.matchSrv.match.players.length >= 4;
    }
}
