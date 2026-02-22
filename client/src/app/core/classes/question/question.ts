import { Choice } from '@app/core/interfaces/choice';
import { IQuestion } from '@app/core/interfaces/i-question';

/**
 * This class allows to handle the logic associated to a question and also
 * to manage his data
 */
export class Question implements IQuestion {
    id: string = '';
    type: string = '';
    text: string = '';
    textEn?: string;
    points: number = 0;
    choices: Choice[] = [];
    timeAllowed: number = 0;
    correctAnswer: number | null;
    lowerBound: number | null;
    upperBound: number | null;
    tolerance: number | null;
    image: string = '';

    constructor(question?: IQuestion) {
        if (question) {
            this.id = question.id;
            this.type = question.type;
            this.text = question.text;
            this.textEn = question.textEn;
            this.points = question.points;
            this.choices = question.choices;
            this.timeAllowed = question.timeAllowed;
            this.correctAnswer = question.correctAnswer;
            this.lowerBound = question.lowerBound;
            this.upperBound = question.upperBound;
            this.tolerance = question.tolerance;
            this.image = question.image;
        }
    }

    getRightChoicesNumber(): number {
        let nRightChoices = 0;
        this.choices.forEach((choice) => {
            if (choice.isCorrect) {
                nRightChoices++;
            }
        });

        return nRightChoices;
    }
}
