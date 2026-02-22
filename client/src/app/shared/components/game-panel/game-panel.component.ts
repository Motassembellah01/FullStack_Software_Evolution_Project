import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, Renderer2 } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Game } from '@app/core/classes/game/game';
import { DIALOG_MESSAGE_EN, DIALOG_MESSAGE_FR } from '@app/core/constants/constants';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { GameServiceService } from '@app/core/http/services/game-service/game-service.service';
import { CancelConfirmationService } from '@app/core/services/cancel-confirmation/cancel-confirmation.service';
import { AppMaterialModule } from '@app/modules/material.module';
import { AlertDialogComponent } from '@app/shared/alert-dialog/alert-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LocalizedFieldPipe } from '@app/shared/pipes/localized-field.pipe';

/**
 * The `GamePanelComponent` represents a user interface component that displays and manages individual game panels
 * within the administrative dashboard. Each panel allows users to interact with and perform various actions on
 * a specific game, such as toggling its visibility, exporting it as a JSON file, or navigating to a modification page.
 *
 * @class GamePanelComponent
 * @implements {OnInit}
 */

@Component({
    selector: 'app-game-panel',
    templateUrl: './game-panel.component.html',
    styleUrls: ['./game-panel.component.scss'],
    standalone: true,
    imports: [AppMaterialModule, CommonModule, TranslateModule, LocalizedFieldPipe],
})
export class GamePanelComponent implements OnInit {
    @Input() gameDirective: Game;

    isVisible: boolean = true;
    creatorName: string = '';

    constructor(
        private gameService: GameServiceService,
        private renderer: Renderer2,
        private confirmationService: CancelConfirmationService,
        private translateService: TranslateService,
        private dialog: MatDialog,
        public accountService: AccountService
    ) {}

    ngOnInit(): void {
        this.isVisible = this.gameDirective.isVisible;
        if (this.gameDirective.creator === 'system') {
            this.creatorName = 'System';
            return;
        }
        this.accountService.getAccount(this.gameDirective.creator).subscribe({
            next: (account) => {
                this.creatorName = account.pseudonym;
            },
            error: () => {
                this.creatorName = this.gameDirective.creator;
            },
        });
    }

    toggleVisibility(): void {
        this.gameService.verifyGameExists(this.gameDirective).subscribe({
            next: () => {
                if (this.gameService.gameExists) {
                    this.isVisible = !this.isVisible;
                    this.gameService.updateGameVisibility(this.gameDirective.id, this.isVisible).subscribe({
                        error: (error: unknown) => {
                            this.dialog.open(AlertDialogComponent, {
                                data: {
                                    title: "ERROR_TITLE.VISIBILITY_UPDATE_ERROR",
                                    messages: JSON.stringify(error)
                                }
                            })
                        },
                    });
                } else {
                    this.dialog.open(AlertDialogComponent, {
                        data: {
                            title: "ERROR_TITLE.GAME_ALREADY_DELETED",
                            messages: []
                        }
                    });
                    this.gameService.updateGameList();
                }
            },
            error: () => {
                this.dialog.open(AlertDialogComponent, {
                    data: {
                        title: "ERROR_TITLE.GAME_ALREADY_DELETED",
                        messages: []
                    }
                });
                this.gameService.updateGameList();
            },
        });
    }
    deleteGameWithConfirmation(): void {
        let dialogMessage;
        if (this.translateService.currentLang === 'fr') {
            dialogMessage = DIALOG_MESSAGE_FR.gameDeletion;
        } else {
            dialogMessage = DIALOG_MESSAGE_EN.gameDeletion;
        }

        this.confirmationService.askConfirmation(this.deleteGame.bind(this), dialogMessage);
    }

    deleteGame(): void {
        this.gameService.verifyGameExists(this.gameDirective).subscribe({
            next: () => {
                if (this.gameService.gameExists) {
                    this.gameService.deleteGame(this.gameDirective.id).subscribe({
                        error: (error: unknown) => {
                            this.dialog.open(AlertDialogComponent, {
                                data: {
                                    title: "ERROR_TITLE.GAME_DELETE_ERROR",
                                    messages: JSON.stringify(error)
                                }
                            })

                        },
                    });
                } else {
                    this.dialog.open(AlertDialogComponent, {
                        data: {
                            title: "ERROR_TITLE.GAME_ALREADY_DELETED",
                            messages: []
                        }
                    });
                    this.gameService.updateGameList();
                }
            },
            error: () => {
                this.dialog.open(AlertDialogComponent, {
                    data: {
                        title: "ERROR_TITLE.GAME_ALREADY_DELETED",
                        messages: []
                    }
                });
                this.gameService.updateGameList();
            },
        });
    }

    navigateModify(): void {
        this.gameService.verifyGameExists(this.gameDirective).subscribe({
            next: () => {
                if (this.gameService.gameExists) {
                    this.gameService.router.navigateByUrl(`administration/create-game/${this.gameDirective.id}`);
                } else {
                    this.dialog.open(AlertDialogComponent, {
                        data: {
                            title: "ERROR_TITLE.GAME_ALREADY_DELETED",
                            messages: []
                        }
                    })
                }
            },
            error: () => {
                this.gameService.updateGameList();
                this.dialog.open(AlertDialogComponent, {
                    data: {
                        title: "ERROR_TITLE.GAME_ALREADY_DELETED",
                        messages: []
                    }
                })
            },
        });
    }

    export(): void {
        this.gameService.verifyGameExists(this.gameDirective).subscribe({
            next: () => {
                if (this.gameService.gameExists) {
                    this.exportGame();
                } else {
                    this.dialog.open(AlertDialogComponent, {
                        data: {
                            title: "ERROR_TITLE.GAME_ALREADY_DELETED",
                            messages: []
                        }
                    })
                }
            },
            error: () => {
                this.gameService.updateGameList();
                this.dialog.open(AlertDialogComponent, {
                    data: {
                        title: "ERROR_TITLE.GAME_ALREADY_DELETED",
                        messages: []
                    }
                })
            },
        });
    }

    filterStringify(game: Game): string {
        const propertiesToCheck: string[] = ['isVisible', '_id', '__v'];
        return JSON.stringify(game, (key, value) => {
            if (key === 'questions' && Array.isArray(value)) {
                return value.map((question) => {
                    if (question && typeof question === 'object' && 'id' in question && 'timeAllowed' in question) {
                        delete question.id;
                        delete question.timeAllowed;
                    }
                    return question;
                });
            }
            if (propertiesToCheck.includes(key)) {
                return undefined;
            }
            return value;
        });
    }

    exportGame(): void {
        const gameJson: string = this.filterStringify(this.gameDirective);
        const blob: Blob = new Blob([gameJson], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const downloadLink = this.renderer.createElement('a');
        this.renderer.setAttribute(downloadLink, 'href', url);
        this.renderer.setAttribute(downloadLink, 'download', `${this.gameDirective.title}.json`);

        downloadLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        window.URL.revokeObjectURL(url);
    }
}
