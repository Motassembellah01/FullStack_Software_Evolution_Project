import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Game } from '@app/core/classes/game/game';
import { CHAR_SETS, HTTP_RESPONSES, LENGTHS } from '@app/core/constants/constants';
import { QuestionService } from '@app/core/services/question-service/question.service';
import { AlertDialogComponent } from '@app/shared/alert-dialog/alert-dialog.component';
import { KeyGenerator } from '@app/shared/key-generator/key-generator';
import { Observable, Subject, map, tap } from 'rxjs';
import { ServerConfigService } from '@app/core/services/server-config/server-config.service';
import { AccountService } from '../account-service/account.service';

@Injectable({
    providedIn: 'root',
})
/**
 * Manages the validation, addition, modification and deletion of a game
 */
export class GameServiceService {
    keyGenerator: KeyGenerator = new KeyGenerator();
    gameVisibilitySubject: Subject<string> = new Subject<string>();
    gameVisibility$ = this.gameVisibilitySubject.asObservable();
    currentGame: Game;
    adminCanceledImport: boolean = false;
    nameExists: boolean;
    errorMessages: string[] = [];
    gameExists: boolean = false;
    gamesUpdatedSubject = new Subject<void>();
    gamesUpdated$ = this.gamesUpdatedSubject.asObservable();
    dialogRef: MatDialogRef<AlertDialogComponent>;
    private games$: Observable<Game[]>;

    constructor(
        private http: HttpClient,
        public questionSrv: QuestionService,
        public router: Router,
        private dialog: MatDialog,
        private accountService: AccountService,
        private serverConfig: ServerConfigService,
    ) {
        this.resetCurrentGame();
        this.updateGameList();
    }

    /**
     * Updates the gameService's games list with the last version in the database
     */
    updateGameList(): void {
        this.games$ = this.getAllGames().pipe(map((games) => Game.parseGames(games)),
            map((games) => games.filter((game) => this.filterGames(game)))
        );
        this.gamesUpdatedSubject.next();
    }

    filterGames(game: Game): boolean {
        return game.isVisible || game.creator === this.accountService.account.userId;
    }
    /**
     * Completes the creation of a new game and returns if the operation was successful or displays errors if the game completed isn't valid
     * @returns if all current games attributes was set successfully
     */
    completeCreationIsSuccessful(): boolean {
        this.setMissingAttributes();
        if (this.isCurrentGameValid()) {
            this.currentGame.id = this.generateId(LENGTHS.gameId);
            return true;
        } else {
            this.displayErrors();
            return false;
        }
    }

    /**
     * Displays the errors that caused the non validation of a game
     */
    displayErrors(): void {
        if (this.errorMessages.length === 0) {
            return;
        }
        this.dialog.open(AlertDialogComponent, {
            data: {
                title: "ERROR_TITLE.CREATE_GAME",
                messages: this.errorMessages
            }
        });
        this.errorMessages = [];
    }

    /**
     * Completes the modification  of a existing game and returns if the operation was successful or displays errors if the game completed isn't valid
     * @returns if all games attributes was set successfully
     */
    completeUpdateIsSuccessful(): boolean {
        this.setCommonAttributes();
        if (this.isCurrentGameValid()) return true;
        else {
            this.displayErrors();
            return false;
        }
    }

    isCurrentGameValid(): boolean {
        this.errorMessages = this.currentGame.validateGame(this.nameExists);
        return this.errorMessages.length === 0;
    }

    /**
     * Call the add game method to add the current game in the games list then reset the current game
     * @returns an observable of the game created
     */
    createGame(): Observable<Game> {
        this.currentGame.creator = this.accountService.account.userId;
        return this.addGame(this.currentGame).pipe(
            map((game) => {
                this.resetCurrentGame();
                return game;
            }),
        );
    }

    verifyGameIsAvailable(id: string, route: string): void {
        this.getGameById(id)
            .pipe(
                tap((game) => {
                    if (game?.isVisible) {
                        this.router.navigateByUrl(route);
                    } else {
                        this.dialog.open(AlertDialogComponent, {
                            data: {
                                title: "ERROR_TITLE.GAME_NOT_ACCESSIBLE",
                                messages: []
                            }
                        });
                        this.gameVisibilitySubject.next('Game no more visible');
                        this.updateGameList();
                    }
                }),
            )
            .subscribe({
                error: (err) => {
                    if (err.status === HTTP_RESPONSES.notFound) {
                        this.dialog.open(AlertDialogComponent, {
                            data: {
                                title: "ERROR_TITLE.GAME_NOT_FOUND",
                                messages: []
                            }
                        });
                        this.gameVisibilitySubject.next('Game no more visible');
                        this.updateGameList();
                    } else {

                        this.dialog.open(AlertDialogComponent, {
                            data: {
                                title: "GENERAL.ERROR",
                                messages: []
                            }
                        });
                    }
                },
            });
    }

    getGameById(id: string): Observable<Game> {
        return this.http.get<Game>(`${this.serverConfig.serverUrl}/games/${id}`).pipe(map((game) => Game.parseGame(game)));
    }

    getGameByTitle(title: string): Observable<Game> {
        return this.http.get<Game>(`${this.serverConfig.serverUrl}/games/title/${title}`).pipe(map((game) => Game.parseGame(game)));
    }

    deleteGame(id: string): Observable<Game | null> {
        return this.http.delete<Game | null>(`${this.serverConfig.serverUrl}/games/${id}`).pipe(
            tap(() => {
                this.updateGameList();
            }),
        );
    }

    addGame(game: Game): Observable<Game> {
        return this.http.post<Game>(`${this.serverConfig.serverUrl}/games`, game).pipe(
            tap(() => {
                this.updateGameList();
            }),
        );
    }

    /**
     * completes the the missing attributes in an imported game then adds it to the games list if it's valid
     * @param game imported game to add in the games list
     */
    importGame(game: Game): void {
        this.currentGame = game;
        this.currentGame.creator = this.accountService.account.userId;
        game.questions.forEach((question) => {
            question.id = this.generateId(LENGTHS.questionId);
            question.timeAllowed = game.duration;
        });
        this.questionSrv.questions = game.questions;
        if (this.completeCreationIsSuccessful()) this.createGame().subscribe();
    }

    updateGame(game: Game): Observable<Game> {
        if (this.gameExists) {
            return this.http.put<Game>(`${this.serverConfig.serverUrl}/games`, game).pipe(
                tap(() => {
                    this.updateGameList();
                    this.resetCurrentGame();
                }),
            );
        } else {
            return this.addGame(game).pipe();
        }
    }

    /**
     * @param game game to verify if it already exists in the games list
     * @returns an observable of the game
     */
    verifyGameExists(game: Game): Observable<Game> {
        return this.getGameById(game.id).pipe(
            tap(() => {
                this.gameExists = true;
            }),
        );
    }

    updateGameVisibility(id: string, isVisible: boolean): Observable<Game> {
        const updateData = { isVisible };
        return this.http.patch<Game>(this.serverConfig.serverUrl + `/games/${id}/update-visibility`, updateData);
    }

    /**
     * sets attributes that need to be set in the creation and modification of a game
     */
    setCommonAttributes(): void {
        this.currentGame.questions = this.questionSrv.questions;

        const date = new Date();
        const dateLocale = date.toLocaleDateString('sv-SE');
        const timeLocale = date.toLocaleTimeString('sv-SE');
        const dateTimeLocale = `${dateLocale} ${timeLocale}`;

        this.currentGame.lastModification = dateTimeLocale;
    }

    /**
     * sets attributes that only need to be set in the creation of a new game
     */
    setMissingAttributes(): void {
        this.setCommonAttributes();
        this.currentGame.isVisible = true;
    }

    resetCurrentGame(): void {
        this.currentGame = new Game();
        this.currentGame.questions = [];
        this.questionSrv.resetQuestions();
    }

    validateName(title: string): Observable<boolean> {
        return this.http.post<{ titleExists: boolean }>(`${this.serverConfig.serverUrl}/games/title`, { title }).pipe(map((result) => result.titleExists));
    }

    generateId(length: number): string {
        return this.keyGenerator.generateKey(CHAR_SETS.id, length);
    }

    getGameList(): Observable<Game[]> {
        return this.games$;
    }

    /**
     * @returns the games list from database
     */
    getAllGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.serverConfig.serverUrl}/games`);
    }
}
