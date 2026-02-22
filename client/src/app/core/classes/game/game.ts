import { Question } from '@app/core/classes/question/question';
import { QCM_TIME } from '@app/core/constants/constants';
import { IGame } from '@app/core/interfaces/game';
import { TranslationService } from '@app/core/services/translate-service/translate.service';

/**
 * This class allows to handle the logic associated to a game and also
 * to manage its data
 */

export class Game implements IGame {
    id: string = '';
    title: string = '';
    titleEn?: string;
    description: string = '';
    descriptionEn?: string;
    duration: number = 0;
    lastModification: string = '';
    questions: Question[] = [];
    isVisible: boolean = true;
    creator: string = '';
    difficultyMap: {key: string, value: number}[];
    interestMap: {key: string, value: number}[];
    durationMap: {key: string, value: number}[];
    rating: {key: string, value: number}[];

    constructor(
        private translateService?: TranslationService,
        game?: IGame,
    ) {
        if (game) {
            this.id = game.id;
            this.title = game.title;
            this.titleEn = game.titleEn;
            this.description = game.description;
            this.descriptionEn = game.descriptionEn;
            this.duration = game.duration;
            this.lastModification = game.lastModification;
            this.questions = game.questions;
            this.isVisible = game.isVisible;
            this.creator = game.creator
            this.difficultyMap = game.difficultyMap;
            this.interestMap = game.interestMap;
            this.durationMap = game.durationMap;
            this.rating = game.rating;
        }
    }

    static parseGames(games: Game[]): Game[] {
        return games.map((game) => this.parseGame(game));
    }

    static parseGame(game: Game): Game {
        const parsedQuestions = game.questions.map((question) => new Question(question));
        game.questions = parsedQuestions;
        const parsedGame = new Game(game.translateService, game);
        return parsedGame;
    }

    static validateAttributesTypes(newGame: Game): string[] {
        const errorMessages: string[] = [];
        const nameValidationMsg = Game.validateNameType(newGame);
        if (nameValidationMsg !== '') errorMessages.push(nameValidationMsg);

        const descriptionValidationMsg = Game.validateDescriptionType(newGame);
        if (descriptionValidationMsg !== '') errorMessages.push(descriptionValidationMsg);

        const qcmTimeValidationMsg = Game.validateQcmTimeType(newGame);
        if (qcmTimeValidationMsg !== '') errorMessages.push(qcmTimeValidationMsg);

        const questionsValidationMsg = Game.validateQuestionsArray(newGame);
        if (questionsValidationMsg !== '') errorMessages.push(questionsValidationMsg);
        return errorMessages;
    }

    static validateNameType(newGame: Game): string {
        let nameIsValid = false;
        if (newGame.title !== undefined) {
            nameIsValid = typeof newGame.title === 'string';
        }

        return !nameIsValid ? 'ERROR_MESSAGE_FOR.NAME_TYPE' : '';
    }

    static validateDescriptionType(newGame: Game): string {
        let descriptionIsValid = false;
        if (newGame.description !== undefined) {
            descriptionIsValid = typeof newGame.description === 'string';
        }

        return !descriptionIsValid ? 'ERROR_MESSAGE_FOR.DESCRIPTION_TYPE' : '';
    }

    static validateQcmTimeType(newGame: Game): string {
        let qcmTimeIsValid = false;
        if (newGame.duration !== undefined) {
            qcmTimeIsValid = newGame.duration !== 0 && typeof newGame.duration === 'number';
        }
        return !qcmTimeIsValid ? 'ERROR_MESSAGE_FOR.QCM_TIME_TYPE' : '';
    }

    static validateQuestionsArray(newGame: Game): string {
        let questionsAreValid = false;
        if (newGame.questions !== undefined) {
            questionsAreValid = Array.isArray(newGame.questions);
        }

        return !questionsAreValid ? 'ERROR_MESSAGE_FOR.QUESTIONS_TYPE' : '';
    }

    isLastQuestion(question: Question): boolean {
        const lastQuestionIndex = this.questions.length - 1;
        return question === this.questions[lastQuestionIndex];
    }

    validateGame(nameExists: boolean): string[] {
        const errorMessages: string[] = [];
        if (nameExists) {
            errorMessages.push('ERROR_MESSAGE_FOR.EXISTING_NAME');
        }
        errorMessages.push(...this.validateOtherAttributes());
        return errorMessages;
    }

    /**
     * Validates a game's attributes except the name which is validated by another method that needs to be asynchronous
     * @returns if attributes are valid
     */
    validateOtherAttributes(): string[] {
        const errorMessages: string[] = [];
        const nameIsPresent = this.validateTextField(this.title);
        if (!nameIsPresent) {
            errorMessages.push('ERROR_MESSAGE_FOR.NAME');
        }

        const descriptionIsValid = this.validateTextField(this.description);
        if (!descriptionIsValid) {
            errorMessages.push('ERROR_MESSAGE_FOR.DESCRIPTION');
        }

        const qcmTimeIsValid = this.validateQcmTime(this.duration);
        if (!qcmTimeIsValid) {
            errorMessages.push('ERROR_MESSAGE_FOR.QCM_TIME');
        }

        const hasAQuestion = this.hasAtLeastOneQuestion();
        if (!hasAQuestion) {
            errorMessages.push('ERROR_MESSAGE_FOR.QUESTIONS');
        }

        return errorMessages;
    }

    validateTextField(textfield: string): boolean {
        return textfield !== undefined && textfield.trim() !== '';
    }

    validateQcmTime(qcmTime: number): boolean {
        return qcmTime >= QCM_TIME.min && qcmTime <= QCM_TIME.max;
    }

    /**
     * @returns if the game has at least one valid question
     */
    hasAtLeastOneQuestion(): boolean {
        return this.questions !== undefined && this.questions.length >= 1;
    }
}
