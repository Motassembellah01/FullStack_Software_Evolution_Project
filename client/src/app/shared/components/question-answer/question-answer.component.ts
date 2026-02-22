import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Question } from '@app/core/classes/question/question';
import { ERRORS, QUESTION_TYPE, SocketsOnEvents, SocketsSendEvents } from '@app/core/constants/constants';
import { AccountService } from '@app/core/http/services/account-service/account.service';
import { Choice } from '@app/core/interfaces/choice';
import { PlayerAnswers } from '@app/core/interfaces/player-answers';
import { UpdateAnswerRequest } from '@app/core/interfaces/update-answer-request';
import { MatchPlayerService } from '@app/core/services/match-player-service/match-player.service';
import { QuestionEvaluationService } from '@app/core/services/question-evaluation/question-evaluation.service';
import { AppMaterialModule } from '@app/modules/material.module';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedFieldPipe } from '@app/shared/pipes/localized-field.pipe';

/**
 * Component that shows a question and its choices if it'a a QCM, or an input where to enter the answer if it's a QRL.
 * When the question type is QCM, the player can select as many choices as he wants either by clicking on the choice
 * or by entering its number using the keyboard. He can also select his answer as final, for both types, using the
 * 'Enter' key.
 *
 * @class QuestionAnswerComponent
 * @implements {OnInit}
 */
@Component({
    selector: 'app-question-answer',
    templateUrl: './question-answer.component.html',
    styleUrls: ['./question-answer.component.scss'],
    standalone: true,
    imports: [AppMaterialModule, CommonModule, FormsModule, TranslateModule, FormsModule, LocalizedFieldPipe],
})
export class QuestionAnswerComponent implements OnInit, OnDestroy {
    @Input() sendEvent: EventEmitter<void>;
    qrlAnswer: string = '';
    question: Question = new Question();
    sendButtonDisabled: boolean = false;
    finalAnswer: boolean = false;
    isFirstAttempt: boolean = true;

    constructor(
        public matchSrv: MatchPlayerService,
        public questionEvaluation: QuestionEvaluationService,
        public accountService: AccountService
    ) {}

    @HostListener('document:keydown', ['$event'])
    buttonDetect(event: KeyboardEvent): void {
        if (this.sendButtonDisabled) return;
        if (!this.matchSrv.isTyping) {
            if (event.key === 'Enter') {
                this.onSend();
            } else {
                const playerChoice = Number(event.key) - 1;
                if (playerChoice >= 0 && playerChoice < this.question.choices.length) {
                    this.onSelect(this.question.choices[playerChoice]);
                }
            }
        }
    }

    ngOnInit(): void {
        if (this.matchSrv.isObserver()) {
            this.matchSrv.socketService.on<PlayerAnswers[]>(SocketsOnEvents.AnswerUpdated, (answers: PlayerAnswers[]) => {
                this.matchSrv.match.playerAnswers = answers;
                if (this.matchSrv.currentQuestion.type === QUESTION_TYPE.qrl) {
                    this.qrlAnswer = this.matchSrv.getQrlAnswer();
                    this.matchSrv.qrlAnswer = this.qrlAnswer;
                    this.questionEvaluation.currentPlayerAnswer = this.qrlAnswer;
                } else if (this.matchSrv.currentQuestion.type === QUESTION_TYPE.qre) {

                    this.matchSrv.qreAnswer = this.matchSrv.getQreAnswer();
                    console.log(this.matchSrv.qreAnswer)
                }
            });
        }
        this.question = this.matchSrv.currentQuestion;
        this.matchSrv.isTypingQrl = false;
        if (this.matchSrv.showingResults) this.sendButtonDisabled = true;
        else this.sendButtonDisabled = false;
        if (!this.matchSrv.isObserver() && this.sendEvent) {
            this.sendEvent.subscribe((event: KeyboardEvent) => {
                this.buttonDetect(event);
            });
        }
    }

    ngOnDestroy(): void {
        if (this.matchSrv.getCurrentQuestion.type === QUESTION_TYPE.qrl && !this.matchSrv.match.testing) {
            this.matchSrv.timeService.stopServerTimer(this.matchSrv.match.accessCode, true);
            this.matchSrv.setCurrentAnswersAsFinal(false);
            if (this.finalAnswer) {
                this.sendButtonDisabled = false;
                this.matchSrv.setCurrentAnswersAsFinal();
            }
            if (!this.matchSrv.isObserver()) this.onSend(true);
        }
    }

    getOptionBackgroundColor(choice: Choice): string {
        if (this.matchSrv.isFinalCurrentAnswer()) {
            return this.matchSrv.isChoiceSelected(choice) ? 'background-yellow-border' : 'gray-bg';
        }

        return this.matchSrv.isChoiceSelected(choice) ? 'background-yellow-border' : 'yellow-bg';
    }

    getAnswerIcon(choice: Choice): string {
        return choice.isCorrect ? 'done' : 'clear';
    }

    onSelect(choice: Choice): void {
        if (this.sendButtonDisabled) return;
        if (this.matchSrv.timeService.timer <= 0 || this.matchSrv.isFinalCurrentAnswer() || this.matchSrv.showingResults) return;

        this.matchSrv.updateCurrentAnswer(choice);
    }

    onSend(isCalledByDestroy: boolean = false): void {
        if (this.matchSrv.isObserver()) {
            return;
        }
        if (this.sendButtonDisabled) return;
        this.finalAnswer = false;

        if (!isCalledByDestroy) this.matchSrv.setCurrentAnswersAsFinal();

        if (!this.matchSrv.match.testing) {
            if (isCalledByDestroy) this.updatePlayerAnswers(false);
            else this.updatePlayerAnswers(true);
        } else {
            this.questionEvaluation.currentPlayerAnswer = this.qrlAnswer;
            this.matchSrv.qrlAnswer = this.qrlAnswer;
            this.matchSrv.showResults();
        }

        this.sendButtonDisabled = true;
    }

    onTextAreaChange(): void {
        this.matchSrv.qrlAnswer = this.qrlAnswer;
        if (this.isFirstAttempt) {
            this.matchSrv.isTypingQrl = true;
            this.matchSrv.updateTypingState(true);
            this.isFirstAttempt = false;
        } else if (!this.matchSrv.isTypingQrl) {
            this.matchSrv.isTypingQrl = true;
            this.matchSrv.updateTypingState(false);
        }
        this.matchSrv.updateTypingState(false);
        if (!this.matchSrv.match.testing && this.matchSrv.currentQuestion.type === QUESTION_TYPE.qrl) {
            this.matchSrv.timeService.startHistogramTimer(this.matchSrv.match.accessCode, this.histogramTimerCallbackAction.bind(this));
        }
    }

    onSliderChange(event: Event): void {
        console.log(this.matchSrv.qreAnswer)
        this.matchSrv.updateTypingState(false);
    }

    histogramTimerCallbackAction(): void {
        this.matchSrv.isTypingQrl = false;
        this.matchSrv.updateTypingState(true);
    }

    updatePlayerAnswers(final: boolean = false): void {
        const playerAnswersIndex: number = this.matchSrv.getCurrentAnswersIndex();

        if (playerAnswersIndex !== ERRORS.noIndexFound) {
            const currentQuestion = this.matchSrv.currentQuestion;
            const playerAnswers = this.matchSrv.match.playerAnswers[playerAnswersIndex];

            if (currentQuestion.type === QUESTION_TYPE.qrl) {
                this.questionEvaluation.currentPlayerAnswer = this.qrlAnswer;
                playerAnswers.qrlAnswer = this.qrlAnswer;
            } else if (currentQuestion.type === QUESTION_TYPE.qre) {
                playerAnswers.qreAnswer = this.matchSrv.qreAnswer;
            } else {
                playerAnswers.lastAnswerTime = this.matchSrv.timeService.timer.toString();
                playerAnswers.obtainedPoints = this.matchSrv.evaluateCurrentQuestion() ? currentQuestion.points : 0;
            }

            this.sendUpdatedAnswers(playerAnswers);
        } else {
            this.createPlayerAnswersAndSend(final);
        }
    }

    sendUpdatedAnswers(playerAnswers: PlayerAnswers): void {
        this.matchSrv.socketService.send<UpdateAnswerRequest>(SocketsSendEvents.SetFinalAnswer, {
            matchAccessCode: this.matchSrv.match.accessCode,
            playerAnswers,
        });
    }

    createPlayerAnswersAndSend(final: boolean = false): void {
        this.matchSrv.socketService.send<UpdateAnswerRequest>(SocketsSendEvents.SetFinalAnswer, {
            matchAccessCode: this.matchSrv.match.accessCode,
            playerAnswers: {
                name: this.accountService.account.pseudonym,
                questionId: this.matchSrv.currentQuestion.id,
                lastAnswerTime: '',
                final,
                obtainedPoints: 0,
                qcmAnswers: [],
                qrlAnswer: this.qrlAnswer,
                qreAnswer: this.matchSrv.qreAnswer,
                isTypingQrl: false,
            },
        });
        this.questionEvaluation.currentPlayerAnswer = this.qrlAnswer;
    }
}
