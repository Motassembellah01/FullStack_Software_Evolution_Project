/**
 * Interface to represent a choice of a question
 * and if the choice is the right answer or not.
 */
export interface Choice {
    text: string;
    textEn?: string;
    isCorrect: boolean;
}
