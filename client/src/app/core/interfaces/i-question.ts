import { Choice } from '@app/core/interfaces/choice';

/**
 * Interface to represent a question and
 * contains all the informations of
 * a question. This interface is implemented
 * by the class Question.
 */
export interface IQuestion {
    id: string;
    type: string;
    text: string;
    textEn?: string;
    points: number;
    choices: Choice[];
    timeAllowed: number;
    correctAnswer: number | null;
    lowerBound: number | null;
    upperBound: number | null;
    tolerance: number | null;
    image: string;
}
