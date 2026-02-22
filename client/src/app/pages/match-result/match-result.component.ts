import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { SocketsSendEvents } from '@app/core/constants/constants';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { GameEvaluation } from '@app/core/interfaces/game-evaluation';
import { HistogramService } from '@app/core/services/histogram-service/histogram.service';
import { MatchPlayerService } from '@app/core/services/match-player-service/match-player.service';
import { SocketService } from '@app/core/websocket/services/socket-service/socket.service';
import { AppMaterialModule } from '@app/modules/material.module';
import { ChatComponent } from '@app/shared/components/chat/chat.component';
import { HistogramComponent } from '@app/shared/components/histogram/histogram.component';
import { LogoComponent } from '@app/shared/components/logo/logo.component';
import { PlayersListComponent } from '@app/shared/components/players-list/players-list.component';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Component of the match results view.
 * It displays the player's list with their score and bonus obtained and has the same chat zone as
 * the match view for both of players and manager.
 * The player or manager can click on "Accueil" button to navigate to the main page
 */
@Component({
    selector: 'app-match-result',
    templateUrl: './match-result.component.html',
    styleUrls: ['./match-result.component.scss'],
    standalone: true,
    imports: [AppMaterialModule, ChatComponent, PlayersListComponent, LogoComponent, HistogramComponent, TranslateModule, CommonModule, FormsModule],
})
export class MatchResultComponent implements OnInit, OnDestroy {
    stars: number[] = [1, 2, 3, 4, 5];

    @ViewChild('evaluateGame') evaluateGame!: TemplateRef<any>;

    selectedRating: number = 0;
    selectedRatingString: string = '';

    isSubmited: boolean = false;

    selectedLabels: {
        difficulty: string | null;
        interest: string | null;
        duration: string | null;
    } = {
            difficulty: null,
            interest: null,
            duration: null,
        };

    constructor(
        public matchPlayerService: MatchPlayerService,
        public histogramService: HistogramService,
        public accountService: AccountService,
        private dialog: MatDialog,
        private socketService: SocketService,
    ) {}

    ngOnInit(): void {
        this.accountService.isInGame = false;
        this.histogramService.isShowingMatchResults = true;
        window.onbeforeunload = () => {
            this.redirectToHome();
        };
        window.onpopstate = () => {
            this.redirectToHome();
        };
        this.accountService.getAccount().subscribe((account) => {
            this.accountService.account = account;
            this.accountService.money = account.money;
        });
    }

    ngOnDestroy(): void {
        this.histogramService.isShowingMatchResults = false;
        window.onbeforeunload = () => {
            return;
        };
        window.onpopstate = () => {
            return;
        };
        this.histogramService.playersAnswered = [];
        this.histogramService.playersWithFinalAnswers = [];
        this.histogramService.quittedPlayers = [];
        this.histogramService.isShowingMatchResults = false;
        this.matchPlayerService.cleanCurrentMatch();
        this.histogramService.questionsStats = new Map();
    }

    redirectToHome(): void {
        this.histogramService.playersAnswered = [];
        this.histogramService.playersWithFinalAnswers = [];
        this.histogramService.quittedPlayers = [];
        this.histogramService.isShowingMatchResults = false;
        this.matchPlayerService.cleanCurrentMatch();
        this.matchPlayerService.router.navigateByUrl('/home');
    }

    onShowPreviousChart(): void {
        this.histogramService.currentChartIndex =
            (this.histogramService.currentChartIndex - 1 + this.histogramService.questionsChartData.length) %
            this.histogramService.questionsChartData.length;
        if (this.histogramService.chart) {
            this.histogramService.chart.destroy();
        }
        this.histogramService.createChart();
    }

    onShowNextChart(): void {
        this.histogramService.currentChartIndex = (this.histogramService.currentChartIndex + 1) % this.histogramService.questionsChartData.length;
        if (this.histogramService.chart) {
            this.histogramService.chart.destroy();
        }
        this.histogramService.createChart();
    }

    setRating(rating: number): void {
        this.selectedRating = rating;
        this.selectedRatingString = rating.toString();
    }

    onSubmit(): void {
        if (!this.selectedRating || !this.selectedLabels.difficulty || !this.selectedLabels.interest || !this.selectedLabels.duration) {
            return;
        }
        this.isSubmited = true;
        const gameEvaluation: GameEvaluation = {
            gameId: this.matchPlayerService.match.game.id,
            difficulty: this.selectedLabels.difficulty,
            interest: this.selectedLabels.interest,
            duration: this.selectedLabels.duration,
            rating: this.selectedRatingString,
        };
        this.sendGameEvaluation(gameEvaluation);
    }

    sendGameEvaluation(gameEvaluation: GameEvaluation): void {
        this.socketService.send<GameEvaluation>(SocketsSendEvents.GameEvaluation, gameEvaluation);
    }

    openEvaluateGame(): void {
        this.dialog.open(this.evaluateGame);
    }
}
