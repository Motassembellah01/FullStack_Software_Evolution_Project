import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Question } from '@app/core/classes/question/question';
import { DIALOG_MESSAGE_EN, DIALOG_MESSAGE_FR } from '@app/core/constants/constants';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { CancelConfirmationService } from '@app/core/services/cancel-confirmation/cancel-confirmation.service';
import { QuestionService } from '@app/core/services/question-service/question.service';
import { AppMaterialModule } from '@app/modules/material.module';
import { QuestionFormComponent } from '@app/shared/components/question-form/question-form.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

/**
 * Uses the question form to display the question's data that have to be modified, manages the
 * modification and update the questionService's questions list with the new question
 *
 * @class ModifyQuestionComponent
 * @implements {OnInit}
 */
@Component({
    selector: 'app-modify-question',
    templateUrl: './modify-question.component.html',
    styleUrls: ['./modify-question.component.scss'],
    standalone: true,
    imports: [CommonModule, AppMaterialModule, QuestionFormComponent, TranslateModule],
})
export class ModifyQuestionComponent implements OnInit {
    currentQuestion: Question;
    previousQuestion: Question;

    // eslint-disable-next-line max-params
    constructor(
        @Inject(MAT_DIALOG_DATA) public data: { index: number },
        private questionService: QuestionService,
        private dialogRef: MatDialogRef<ModifyQuestionComponent>,
        private confirmationService: CancelConfirmationService,
        private translateService: TranslateService,
        public accountService: AccountService,
    ) {}

    ngOnInit(): void {
        this.currentQuestion = this.questionService.getQuestionByIndex(this.data.index);
        this.previousQuestion = JSON.parse(JSON.stringify(this.currentQuestion));
    }

    onSaveQuestion(): void {
        if (this.questionService.validateUpdatedQuestion(this.currentQuestion)) this.dialogRef?.close();
    }
    onCancelModification(): void {
        let dialogMessage;
        if (this.translateService.currentLang === 'fr') {
            dialogMessage = DIALOG_MESSAGE_FR.cancelQuestionModification;
        } else {
            dialogMessage = DIALOG_MESSAGE_EN.cancelQuestionModification;
        }

        this.confirmationService.askConfirmation(() => {
            this.questionService.cancelQuestionModification(this.previousQuestion, this.data.index);
            this.dialogRef?.close();
        }, dialogMessage);
    }
}
