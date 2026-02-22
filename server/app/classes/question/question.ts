import { Choice } from '@app/interfaces/choice';

/**
 * Class represent how question are stored in the server
 */
export class Question {
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


    constructor(question: Partial<Question> = {}) {
        this.id = question.id || '';
        this.type = question.type || '';
        this.text = question.text || '';
        this.textEn = question.textEn;
        this.points = question.points || 0;
        this.choices = question.choices || [];
        this.timeAllowed = question.timeAllowed || 0;
        this.correctAnswer = question.correctAnswer || null;
        this.lowerBound = question.lowerBound || null;
        this.upperBound = question.upperBound || null;
        this.tolerance = question.tolerance || null;
        this.image = question.image || '';
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

    evaluateQreQuestion(answer: number): boolean {
        if (
            this.lowerBound === null ||
            this.upperBound === null ||
            this.tolerance === null
        ) {
            throw new Error('Missing required bounds or tolerance for QRE evaluation.');
        }

        console.log(this.lowerBound, this.upperBound, this.tolerance, answer)

        if (answer < this.lowerBound || answer > this.upperBound) {
            return false;
        }

        const toleranceMin = answer - this.tolerance;
        const toleranceMax = answer + this.tolerance;

        const validMin = Math.max(this.lowerBound, toleranceMin);
        const validMax = Math.min(this.upperBound, toleranceMax);

        return answer >= validMin && answer <= validMax;
    }

}
