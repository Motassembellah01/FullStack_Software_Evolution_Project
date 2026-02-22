import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Question } from '@app/core/classes/question/question';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { Choice } from '@app/core/interfaces/choice';
import { AppMaterialModule } from '@app/modules/material.module';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedFieldPipe } from '@app/shared/pipes/localized-field.pipe';

/**
 * Component that provides the question and its choices template for the manager
 *
 * @class QuestionDisplayComponent
 */
@Component({
    selector: 'app-question-display',
    templateUrl: './question-display.component.html',
    styleUrls: ['./question-display.component.scss'],
    standalone: true,
    imports: [AppMaterialModule, CommonModule, TranslateModule, LocalizedFieldPipe],
})
export class QuestionDisplayComponent {
    @Input() question: Question;
    constructor(public accountService: AccountService) {}

    
    getAnswerIcon(choice: Choice): string {
        return choice.isCorrect ? 'done' : 'clear';
    }
}
