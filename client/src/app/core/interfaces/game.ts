import { Question } from '@app/core/classes/question/question';

/**
 * Interface to represent a game and
 * contains all the informations of
 * a game. This interface is implemented
 * by the class Game.
 */
export interface IGame {
    id: string;
    title: string;
    titleEn?: string;
    description: string;
    descriptionEn?: string;
    duration: number;
    lastModification: string;
    questions: Question[];
    isVisible: boolean;
    creator: string;
    difficultyMap: {key: string, value: number}[];
    interestMap: {key: string, value: number}[];
    durationMap: {key: string, value: number}[];
    rating: {key: string, value: number}[];
}
