import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Question } from '@app/core/classes/question/question';
import { DIALOG } from '@app/core/constants/constants';
import { QuestionService } from '@app/core/services/question-service/question.service';
import { AppMaterialModule } from '@app/modules/material.module';
import { ModifyQuestionComponent } from '@app/shared/components/modify-question/modify-question.component';

/**
 * Manages the display of questions in the game form and the deletion and modification of each question
 *
 * @class QuestionListComponent
 */
@Component({
    selector: 'app-question-list',
    templateUrl: './question-list.component.html',
    styleUrls: ['./question-list.component.scss'],
    standalone: true,
    imports: [AppMaterialModule, CommonModule],
})
export class QuestionListComponent {
    question: Question;
    constructor(
        public questionService: QuestionService,
        public dialog: MatDialog,
    ) {}

    onDrop(event: CdkDragDrop<string[]>): void {
        moveItemInArray(this.questionService.questions, event.previousIndex, event.currentIndex);
    }

    onDeleteQuestion(index: number): void {
        this.questionService.questions.splice(index, 1);
    }

    onModifyQuestion(i: number): void {
        this.dialog.open(ModifyQuestionComponent, {
            width: DIALOG.questionFormWidth,
            disableClose: true,
            data: {
                index: i,
            },
        });
    }
}
