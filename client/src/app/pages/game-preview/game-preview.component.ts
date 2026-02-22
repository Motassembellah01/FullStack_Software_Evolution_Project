import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Game } from '@app/core/classes/game/game';
import { CreateMatchDto } from '@app/core/classes/match/dto/create-match.dto';
import { Match } from '@app/core/classes/match/match';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { GameServiceService } from '@app/core/http/services/game-service/game-service.service';
import { MatchCommunicationService } from '@app/core/http/services/match-communication/match-communication.service';
import { IMatch } from '@app/core/interfaces/i-match';
import { MatchRouteParams } from '@app/core/interfaces/match-route-params';
import { Player } from '@app/core/interfaces/player';
import { HistogramService } from '@app/core/services/histogram-service/histogram.service';
import { MatchPlayerService } from '@app/core/services/match-player-service/match-player.service';
import { AppMaterialModule } from '@app/modules/material.module';
import { AlertDialogComponent } from '@app/shared/alert-dialog/alert-dialog.component';
import { LogoComponent } from '@app/shared/components/logo/logo.component';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, Subscription, tap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { LocalizedFieldPipe } from '@app/shared/pipes/localized-field.pipe';

@Component({
    selector: 'app-game-preview',
    templateUrl: './game-preview.component.html',
    styleUrls: ['./game-preview.component.scss'],
    standalone: true,
    imports: [AppMaterialModule, LogoComponent, CommonModule, RouterModule, TranslateModule, FormsModule, LocalizedFieldPipe],
})

/**
 * Component that shows a selected game details.
 * The manager can create a match with that game or he can test it
 * On both cases, if the game was deleted or is no longer visible, he will be notified
 * and redirected to the Creation view so he can select another game from the updated list
 */
export class GamePreviewComponent implements OnInit {
    validationSubscription: Subscription;
    game$: Observable<Game>;
    currentGame: Game;
    isTeamMatch: boolean = false;
    isPricedMatch: boolean = false;
    priceMatch: number = 0;
    nbPlayersJoined: number = 0;
    isOnlyFriends: boolean = false;
    players: Player[] = [];
    dialogRef: any; 
    @ViewChild('matchConfigDialog') matchConfigDialog: any;

    constructor(
        private readonly gameService: GameServiceService,
        private readonly route: ActivatedRoute,
        private readonly matchCommunicationService: MatchCommunicationService,
        public accountService: AccountService,
        private readonly matchPlayerService: MatchPlayerService,
        private historgramService: HistogramService,
        private dialog: MatDialog
    ) {}

    ngOnInit(): void {
        this.game$ = this.gameService.getGameById(this.route.snapshot.params['id']).pipe(
            tap((game) => {
                this.currentGame = game;
            }),
        );
        this.game$.subscribe({
            error: (err) => {
                this.dialog.open(AlertDialogComponent, {
                    data: {
                        title: "GENERAL.ERROR",
                        messages: JSON.stringify(err)
                    }
                })
            },
        });
        this.gameService.gameVisibility$.subscribe({
            next: () => {
                this.accountService.isInGame = false;
                this.gameService.router.navigateByUrl('/create');
            },
        });
    }

    onCreateMatch(id: string): void {
        this.matchPlayerService.cleanCurrentMatch();
        this.historgramService.resetAttributes();
        const matchInfo: MatchRouteParams = { id, testing: false };
        this.gameService.verifyGameIsAvailable(id, `create/wait/game/${JSON.stringify(matchInfo)}`);
        const createMatchDto: CreateMatchDto = {
            game: this.currentGame,
            managerName: this.accountService.account.pseudonym,
            managerId: this.accountService.auth0Id,
            isFriendMatch: this.isOnlyFriends,
            isTeamMatch: this.isTeamMatch,
            isPricedMatch: this.isPricedMatch, 
            priceMatch: this.priceMatch,
            nbPlayersJoined: this.nbPlayersJoined,
            players: this.players,
        }
        this.matchCommunicationService.createMatch(
            createMatchDto
        ).subscribe((match: IMatch) => {
            this.accountService.isInGame = true;
            this.matchPlayerService.setCurrentMatch(
                new Match(match),
                {
                    name: this.accountService.account.pseudonym,
                    isActive: true,
                    score: 0,
                    nBonusObtained: 0,
                    chatBlocked: false,
                    avatar: this.accountService.getLocalAvatar(this.accountService.account.avatarUrl)
                },
            );
            this.matchPlayerService.initializeScore();
        });
    }

    openMatchConfigDialog(): void {
        const dialogRef = this.dialog.open(this.matchConfigDialog, {
            width: '400px',
            disableClose: true,
        });
    
        dialogRef.afterClosed();
    }
}
