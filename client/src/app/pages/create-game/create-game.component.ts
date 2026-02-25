import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { Game } from '@app/core/classes/game/game';
import { DIALOG_MESSAGE_EN, DIALOG_MESSAGE_FR, SNACKBAR_DURATION, SNACKBAR_MESSAGE_EN, SNACKBAR_MESSAGE_FR } from '@app/core/constants/constants';
import { GameServiceService } from '@app/core/http/services/game-service/game-service.service';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { CancelConfirmationService } from '@app/core/services/cancel-confirmation/cancel-confirmation.service';
import { AppMaterialModule } from '@app/modules/material.module';
import { AlertDialogComponent } from '@app/shared/alert-dialog/alert-dialog.component';
import { GameFormComponent } from '@app/shared/components/game-form/game-form.component';
import { LogoComponent } from '@app/shared/components/logo/logo.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-create-game',
    templateUrl: './create-game.component.html',
    styleUrls: ['./create-game.component.scss'],
    standalone: true,
    imports: [CommonModule, AppMaterialModule, LogoComponent, GameFormComponent, TranslateModule],
})

/**
 * Manages the creation and modification of a game by using the game form component and adding elements
 * to save the creation or modification or cancel it.
 */
export class CreateGameComponent implements OnInit {
    oldGameName: string;

    // eslint-disable-next-line max-params
    constructor(
        public gameService: GameServiceService,
        private confirmationService: CancelConfirmationService,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
        private translateService: TranslateService,
        private dialog: MatDialog,
        public accountService: AccountService
    ) {}

    ngOnInit(): void {
        const gameId = this.route.snapshot.params['id'];
        if (gameId) {
            this.gameService.getGameById(gameId).subscribe((game: Game) => {
                this.gameService.currentGame = game;
                this.oldGameName = game.title;
                this.gameService.questionSrv.questions = this.gameService.currentGame.questions;
            });
        }
    }

    onSave(): void {
        if (this.gameService.currentGame.id) {
            this.onUpdateGame();
        } else {
            this.onCreateGame();
        }
    }
    onCancel(): void {
        let dialogMessage;
        if (this.translateService.currentLang === 'fr') {
            dialogMessage = this.gameService.currentGame.id ? DIALOG_MESSAGE_FR.cancelModifyGame : DIALOG_MESSAGE_FR.cancelGameCreation;
        } else {
            dialogMessage = this.gameService.currentGame.id ? DIALOG_MESSAGE_EN.cancelModifyGame : DIALOG_MESSAGE_EN.cancelGameCreation;
        }

        this.confirmationService.askConfirmation(() => {
            this.gameService.resetCurrentGame();
            this.gameService.router.navigateByUrl('administration');
        }, dialogMessage);
    }

    onCreateGame(): void {
        this.gameService.validateName(this.gameService.currentGame.title).subscribe({
            error: (e) => {
                this.dialog.open(AlertDialogComponent, {
                    data: {
                        title: "GENERAL.ERROR",
                        messages: JSON.stringify(e)
                    }
                })
            },
            next: (nameExists) => {
                try {
                    this.validNameHandler(nameExists);
                } catch (e) {
                    this.dialog.open(AlertDialogComponent, {
                        data: {
                            title: "GENERAL.ERROR",
                            messages: JSON.stringify(e)
                        }
                    })
                }
            },
        });
    }

    onUpdateGame(): void {
        this.gameService.validateName(this.gameService.currentGame.title).subscribe({
            error: (e) => {
                this.dialog.open(AlertDialogComponent, {
                    data: {
                        title: "GENERAL.ERROR",
                        messages: JSON.stringify(e)
                    }
                })
            },
            next: (nameExists) => {
                this.gameService.nameExists = this.oldGameName === this.gameService.currentGame.title ? false : nameExists;
                if (this.gameService.completeUpdateIsSuccessful()) {
                    this.gameService.verifyGameExists(this.gameService.currentGame).subscribe({
                        next: () => {
                            this.gameService.updateGame(this.gameService.currentGame).subscribe({
                                next: () => {
                                    this.gameService.router.navigateByUrl('administration');
                                    if (this.translateService.currentLang === 'fr') this.showSnackbar(SNACKBAR_MESSAGE_FR.gameUpdated);
                                    else this.showSnackbar(SNACKBAR_MESSAGE_EN.gameUpdated);
                                },
                            });
                        },
                        error: () => {
                            if (this.gameService.completeCreationIsSuccessful())
                                this.gameService.createGame().subscribe({
                                    next: () => {
                                        this.gameService.router.navigateByUrl('administration');
                                    },
                                });
                        },
                    });
                }
            },
        });
    }

    validNameHandler(nameExists: boolean): void {
        this.gameService.currentGame.questions.forEach((question) => (question.timeAllowed = this.gameService.currentGame.duration));
        this.gameService.nameExists = nameExists;
        if (this.gameService.completeCreationIsSuccessful()) {
            this.gameService.createGame().subscribe({
                next: () => {
                    this.gameService.router.navigateByUrl('administration/home');
                    if (this.translateService.currentLang === 'fr') this.showSnackbar(SNACKBAR_MESSAGE_FR.gameCreated);
                    else this.showSnackbar(SNACKBAR_MESSAGE_EN.gameCreated);
                },
            });
        }
    }

    private showSnackbar(message: string): void {
        this.snackBar.open(message, 'Fermer', {
            duration: SNACKBAR_DURATION,
        });
    }
}
