import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { DIALOG, QCM_TIME } from '@app/core/constants/constants';
import { GameServiceService } from '@app/core/http/services/game-service/game-service.service';
import { AppMaterialModule } from '@app/modules/material.module';
import { AlertDialogComponent } from '@app/shared/alert-dialog/alert-dialog.component';
import { CreateQuestionComponent } from '@app/shared/components/create-question/create-question.component';
import { QuestionListComponent } from '@app/shared/components/question-list/question-list.component';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Component that manages the game's creation and modification form
 *
 * @class GameFormComponent
 * @implements {OnInit}
 */
@Component({
    selector: 'app-game-form',
    templateUrl: './game-form.component.html',
    styleUrls: ['./game-form.component.scss'],
    standalone: true,
    imports: [AppMaterialModule, QuestionListComponent, FormsModule, CommonModule, TranslateModule],
})
export class GameFormComponent implements OnInit {
    constructor(
        public gameService: GameServiceService,
        public dialog: MatDialog,
        private router: Router,
    ) {}

    ngOnInit(): void {
        this.gameService.currentGame.duration = QCM_TIME.min;
        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                this.gameService.resetCurrentGame();
            }
        });
    }

    validateQcmTime(): void {
        if (!this.gameService.currentGame.validateQcmTime(this.gameService.currentGame.duration)) {
            this.dialog.open(AlertDialogComponent, {
                data: {
                    title: "ERROR_TITLE.QCM_TIME_INVALID",
                    messages: []
                }
            })
            this.gameService.currentGame.duration = this.gameService.currentGame.duration > QCM_TIME.max ? QCM_TIME.max : QCM_TIME.min;
        }
    }

    validateNameInput(): boolean {
        return this.gameService.currentGame.validateTextField(this.gameService.currentGame.title);
    }

    validateDescriptionInput(): boolean {
        return this.gameService.currentGame.validateTextField(this.gameService.currentGame.description);
    }

    onOpenQuestionForm(): void {
        this.dialog.open(CreateQuestionComponent, { width: DIALOG.questionFormWidth, disableClose: true });
    }
}
