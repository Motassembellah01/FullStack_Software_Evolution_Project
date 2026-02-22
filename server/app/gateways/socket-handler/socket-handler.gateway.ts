import { CreateTeamDto } from '@app/classes/match/dto/create-team.dto';
import { NewPlayerDto } from '@app/classes/match/dto/new-player.dto';
import { UpdateScoreDto } from '@app/classes/match/dto/update-score.dto';
import { Match } from '@app/classes/match/match';
import { Team } from '@app/classes/match/team';
import { PlayerAnswers } from '@app/classes/player-answers/player-answers';
import { NAMES, SocketsEmitEvents, SocketsSubscribeEvents } from '@app/constants/constants';
import { ChatAccessibilityRequest } from '@app/interfaces/chat-accessibility-request';
import { GameEvaluation } from '@app/interfaces/game-evaluation';
import { JoinMatchObserverDto } from '@app/interfaces/join-match-observer.dto';
import { Message } from '@app/interfaces/message';
import { Observer } from '@app/interfaces/Observer';
import { ObserverQuitRequest } from '@app/interfaces/observer-quit-request';
import { PlayerRequest } from '@app/interfaces/player-request';
import { QuestionRequest } from '@app/interfaces/question-request';
import { Room } from '@app/interfaces/room';
import { StopServerTimerRequest } from '@app/interfaces/stop-server-timer-request';
import { TimerRequest } from '@app/interfaces/timer-request';
import { UpdateAnswerRequest } from '@app/interfaces/update-answer-request';
import { UpdateChartDataRequest } from '@app/interfaces/update-chart-data-request';
import { AccountService } from '@app/services/account/account.service';
import { GameService } from '@app/services/game/game.service';
import { MatchService } from '@app/services/match/match.service';
import { Injectable, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Utils } from 'utils/utils';

/**
 * This class allows us to communicate with the clients via websocket.
 * It contains all the webSockets events handled by our server
 */
@Injectable()
@WebSocketGateway()
export class SocketHandlerGateway {
    @WebSocketServer()
    server: Server;
    timerIntervalMap: Map<string, NodeJS.Timer> = new Map();
    histogramInterval: Map<string, NodeJS.Timer> = new Map();

    constructor(
        private readonly matchService: MatchService,
        private readonly accountService: AccountService,
        private logger: Logger,
        private gameService: GameService,
    ) {}

    @SubscribeMessage(SocketsSubscribeEvents.JoinMatch)
    joinMatchRoom(@ConnectedSocket() client: Socket, @MessageBody() player: PlayerRequest | string): void {
        let parsedPlayer: PlayerRequest;
        if (typeof player == 'string') {
            parsedPlayer = JSON.parse(player) as PlayerRequest;
        } else {
            parsedPlayer = player;
        }
        this.matchService.matches.forEach((match) => {
            if (match.accessCode !== parsedPlayer.roomId) {
                client.leave(match.accessCode);
            }
        });
        client.join(parsedPlayer.roomId);
        const match = this.matchService.getMatchByAccessCode(parsedPlayer.roomId);
        if (parsedPlayer.name === NAMES.manager || parsedPlayer.name === NAMES.tester || parsedPlayer.name === match.managerName) return;
        try {
            this.matchService.logger.log('Player is joining match: ', parsedPlayer.name);
            this.matchService.logger.log('With accessCode : ' + parsedPlayer.roomId);
            this.matchService.addPlayer({
                accessCode: parsedPlayer.roomId,
                player: { name: parsedPlayer.name, isActive: true, score: 0, nBonusObtained: 0, chatBlocked: false },
            });
            this.matchService.addPlayerToBannedPlayer({
                accessCode: parsedPlayer.roomId,
                player: { name: parsedPlayer.name, isActive: true, score: 0, nBonusObtained: 0, chatBlocked: false },
            });

            match.nbPlayersJoined += 1;

            const newPlayersList = this.matchService.getPlayersList({ accessCode: parsedPlayer.roomId });
            const newPlayerDto: NewPlayerDto = {
                players: newPlayersList,
                isTeamMatch: match.isTeamMatch,
                teams: match.teams,
                isPricedMatch: match.isPricedMatch,
                priceMatch: match.priceMatch,
                nbPlayersJoined: match.nbPlayersJoined,
            };
            this.server.to(parsedPlayer.roomId).emit(SocketsEmitEvents.NewPlayer, newPlayerDto);
        } catch (error) {
            this.matchService.logger.log('an error occurred while getting players list', error);
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.JoinMatchObserver)
    joinMatchRoomAsObserver(@ConnectedSocket() client: Socket, @MessageBody() observer: JoinMatchObserverDto): void {
        client.join(observer.accessCode);
        const match = this.matchService.getMatchByAccessCode(observer.accessCode);
        try {
            this.matchService.logger.log('Observer is joining match: ', observer.name);
            this.matchService.addObserver({
                accessCode: observer.accessCode,
                observer: { name: observer.name, observedName: match.managerName },
            });

            this.server.to(observer.accessCode).emit(SocketsEmitEvents.JoinedMatchObserver, {
                match,
                addedObserverName: observer.name,
            });
        } catch (error) {
            this.matchService.logger.log('an error occurred while getting players list', error);
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.SendMessage)
    sendMessage(@ConnectedSocket() client: Socket, @MessageBody() msg: Message): void {
        // only send message if client is in the match room
        if (client.rooms.has(msg.matchAccessCode)) {
            this.server.to(msg.matchAccessCode).emit(SocketsEmitEvents.ChatMessage, msg);
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.SwitchQuestion)
    switchQuestion(@ConnectedSocket() client: Socket, @MessageBody() obj: { accessCode: string; currentQuestionIndex: number }): void {
        if (typeof obj === 'string') {
            obj = JSON.parse(obj) as { accessCode: string; currentQuestionIndex: number };
        }
        console.log(obj);
        this.matchService.getMatchByAccessCode(obj.accessCode).currentQuestionIndex = obj.currentQuestionIndex;
        this.server.to(obj.accessCode).emit(SocketsEmitEvents.NextQuestion, { currentQuestionIndex: obj.currentQuestionIndex });
    }

    @SubscribeMessage(SocketsSubscribeEvents.SendChartData)
    sendQuestionSelectedChoices(@ConnectedSocket() client: Socket, @MessageBody() updateChartDataRequest: UpdateChartDataRequest): void {
        this.server.to(updateChartDataRequest.matchAccessCode).emit(SocketsEmitEvents.UpdateChartDataList, updateChartDataRequest.questionChartData);
    }

    @SubscribeMessage(SocketsSubscribeEvents.PanicModeActivated)
    panicModeActivatedHandler(@ConnectedSocket() client: Socket, @MessageBody() room: Room | string): void {
        if (typeof room === 'string') {
            room = JSON.parse(room) as Room;
        }

        try {
            const match = this.matchService.getMatchByAccessCode(room.id);
            match.panicMode = true;
        } catch (error) {
            this.matchService.logger.log('an error occurred', error);
        }

        this.server.to(room.id).emit(SocketsEmitEvents.PanicModeActivated, {});
    }

    @SubscribeMessage(SocketsSubscribeEvents.UpdateAnswer)
    updateAnswer(@ConnectedSocket() client: Socket, @MessageBody() answerRequest: UpdateAnswerRequest | string): void {
        let newPlayersAnswersList: PlayerAnswers[];
        try {
            // If answerRequest is a string, parse it
            if (typeof answerRequest === 'string') {
                answerRequest = JSON.parse(answerRequest);
            }

            console.log(JSON.stringify(answerRequest));

            // Assert that answerRequest is of type UpdateAnswerRequest
            const updateAnswerRequest = answerRequest as UpdateAnswerRequest;

            // Now you can safely access matchAccessCode
            this.matchService.updatePlayerAnswers(updateAnswerRequest);
            const match = this.matchService.getMatchByAccessCode(updateAnswerRequest.matchAccessCode);
            newPlayersAnswersList = match.getPlayersAnswersList();
            this.server.to(updateAnswerRequest.matchAccessCode).emit(SocketsEmitEvents.AnswerUpdated, newPlayersAnswersList);
        } catch (error) {
            this.matchService.logger.log('an error occurred', error);
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.StartTimer)
    updateTimer(@ConnectedSocket() client: Socket, @MessageBody() timerRequest: TimerRequest | string): void {
        try {
            if (typeof timerRequest === 'string') {
                timerRequest = JSON.parse(timerRequest) as TimerRequest;
            }

            const updatedTimerRequest = timerRequest as TimerRequest;

            if (this.timerIntervalMap.has(timerRequest.roomId)) {
                this.stopTimer(this.timerIntervalMap, timerRequest.roomId);
            }
            this.timerIntervalMap.set(
                updatedTimerRequest.roomId,
                setInterval(() => {
                    if (updatedTimerRequest.timer > 0) {
                        this.server.to(updatedTimerRequest.roomId).emit(SocketsEmitEvents.NewTime, {
                            roomId: updatedTimerRequest.roomId,
                            timer: --updatedTimerRequest.timer,
                        });

                        try {
                            const match = this.matchService.getMatchByAccessCode(updatedTimerRequest.roomId);
                            match.timer = updatedTimerRequest.timer;
                            this.matchService.logger.log('Timer', match.timer);
                        } catch (error) {
                            this.matchService.logger.log('an error occurred', error);
                        }
                    } else this.stopTimer(this.timerIntervalMap, updatedTimerRequest.roomId);
                }, updatedTimerRequest.timeInterval),
            );
        } catch (error) {
            this.matchService.logger.log('an error occurred', error);
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.HistogramTime)
    updateHistogramTime(@ConnectedSocket() client: Socket, @MessageBody() timerRequest: TimerRequest | string): void {
        try {
            if (typeof timerRequest == 'string') {
                timerRequest = JSON.parse(timerRequest);
            }

            const updatedTimerRequest = timerRequest as TimerRequest;

            const intervalKey = updatedTimerRequest.roomId + client.id;
            if (this.histogramInterval.has(intervalKey)) {
                this.stopTimer(this.histogramInterval, intervalKey);
            }
            let timer = 0;
            this.histogramInterval.set(
                intervalKey,
                setInterval(() => {
                    this.server.to(client.id).emit(SocketsEmitEvents.HistogramTime, { roomId: updatedTimerRequest.roomId, timer: ++timer });
                }, updatedTimerRequest.timeInterval),
            );
        } catch (error) {
            this.matchService.logger.log('an error occurred', error);
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.StopTimer)
    stopTimerHandler(@ConnectedSocket() client: Socket, @MessageBody() stopServerTimerRequest: StopServerTimerRequest | string): void {
        try {
            if (typeof stopServerTimerRequest == 'string') {
                stopServerTimerRequest = JSON.parse(stopServerTimerRequest) as StopServerTimerRequest;
            }
            if (stopServerTimerRequest.isHistogramTimer) this.stopTimer(this.histogramInterval, stopServerTimerRequest.roomId + client.id);
            else this.stopTimer(this.timerIntervalMap, stopServerTimerRequest.roomId);
        } catch (error) {
            this.matchService.logger.log('an error occurred', error);
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.CancelGame)
    cancelGame(@ConnectedSocket() client: Socket, @MessageBody() room: Room): void {
        if (typeof room === 'string') {
            room = JSON.parse(room) as Room;
        }
        this.server.to(room.id).emit(SocketsEmitEvents.GameCanceled);
        this.leaveAllRoom(room.id);
    }

    @SubscribeMessage(SocketsSubscribeEvents.FinishMatch)
    async finishMatch(@ConnectedSocket() client: Socket, @MessageBody() room: Room | string): Promise<void> {
        if (typeof room === 'string') {
            room = JSON.parse(room) as Room;
        }
        this.server.to(room.id).emit(SocketsEmitEvents.MatchFinished, {});
        this.leaveAllRoom(room.id);
    }

    @SubscribeMessage(SocketsSubscribeEvents.BeginMatch)
    async redirectPlayersToMatch(@ConnectedSocket() client: Socket, @MessageBody() room: Room | string): Promise<void> {
        try {
            if (typeof room == 'string') {
                room = JSON.parse(room) as Room;
            }

            const match: Match = this.matchService.getMatchByAccessCode(room.id);
            if (match.isTeamMatch) match.teams = match.teams?.filter((team) => team.players.length > 0);
            match.begin = Utils.formatDateToReadable();
            this.server.to(room.id).emit(SocketsEmitEvents.JoinBegunMatch, match);
        } catch (error) {
            this.matchService.logger.log('an error occurred', error);
        }
    }

    /**
     * Remove a player from the player list and
     * remove his name from banned name list if he has been removed by manager
     * @param client the socket
     * @param player the player information
     */
    @SubscribeMessage(SocketsSubscribeEvents.RemovePlayer)
    removePlayer(@ConnectedSocket() client: Socket, @MessageBody() player: PlayerRequest | string): void {
        try {
            if (typeof player == 'string') {
                player = JSON.parse(player) as PlayerRequest;
            }
            this.matchService.removePlayer({
                accessCode: player.roomId,
                player: { name: player.name, isActive: true, score: 0, nBonusObtained: 0, chatBlocked: false },
            });
            if (player.hasPlayerLeft) {
                this.matchService.removePlayerToBannedName({
                    accessCode: player.roomId,
                    player: { name: player.name, isActive: true, score: 0, nBonusObtained: 0, chatBlocked: false },
                });
            }
            const match: Match = this.matchService.getMatchByAccessCode(player.roomId);
            const newPlayerDto: NewPlayerDto = {
                players: match.players,
                teams: match.teams,
                isTeamMatch: match.isTeamMatch,
                isPricedMatch: match.isPricedMatch,
                priceMatch: match.priceMatch,
                nbPlayersJoined: match.nbPlayersJoined,
            };
            this.server.to(player.roomId).emit(SocketsEmitEvents.PlayerRemoved, newPlayerDto);
            if (player.hasPlayerLeft) {
                client.leave(player.roomId);
            }
        } catch (error) {
            this.matchService.logger.log('an error occurred', error);
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.UpdateScore)
    updatePlayerScore(@ConnectedSocket() client: Socket, @MessageBody() questionRequest: QuestionRequest | string): void {
        try {
            if (typeof questionRequest == 'string') {
                questionRequest = JSON.parse(questionRequest);
            }
            const updatedQuestionRequest = questionRequest as QuestionRequest;
            console.log(updatedQuestionRequest.questionId);
            this.matchService.updatePlayerScore(
                updatedQuestionRequest.matchAccessCode,
                updatedQuestionRequest.player,
                updatedQuestionRequest.questionId,
            );
            const match = this.matchService.getMatchByAccessCode(updatedQuestionRequest.matchAccessCode);
            const player = this.matchService.getPlayerFromMatch(updatedQuestionRequest.matchAccessCode, updatedQuestionRequest.player.name);

            const updateScoreDto: UpdateScoreDto = {
                teams: match.teams,
                player,
            };

            this.server.to(updatedQuestionRequest.matchAccessCode).emit(SocketsEmitEvents.UpdatedScore, updateScoreDto);
        } catch (error) {
            this.matchService.logger.log('an error occurred while updating player score', error.message);
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.SetFinalAnswer)
    setFinalAnswer(@ConnectedSocket() client: Socket, @MessageBody() answerRequest: UpdateAnswerRequest | string): void {
        console.log('answerRequest : ' + JSON.stringify(answerRequest) + ' type : ' + typeof answerRequest);
        try {
            if (typeof answerRequest === 'string') {
                answerRequest = JSON.parse(answerRequest) as UpdateAnswerRequest;
            }
            this.matchService.setPlayerAnswersLastAnswerTimeAndFinal(answerRequest.matchAccessCode, answerRequest.playerAnswers);
            this.server.to(answerRequest.matchAccessCode).emit(SocketsEmitEvents.FinalAnswerSet, answerRequest.playerAnswers);
            if (this.matchService.allPlayersResponded(answerRequest.matchAccessCode, answerRequest.playerAnswers.questionId)) {
                this.matchService.getMatchByAccessCode(answerRequest.matchAccessCode).timer = 0;
                console.log('All players answered for match ' + answerRequest.matchAccessCode);
                this.server.to(answerRequest.matchAccessCode).emit(SocketsEmitEvents.AllPlayersResponded, {});
            }
        } catch (error) {
            this.matchService.logger.log('an error occurred while setting final answer', error.message);
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.PlayerLeftAfterMatchBegun)
    async disablePlayer(@ConnectedSocket() client: Socket, @MessageBody() questionRequest: QuestionRequest | string): Promise<void> {
        console.log('QuestionRequest : ' + questionRequest.toString());
        try {
            if (typeof questionRequest == 'string') {
                questionRequest = JSON.parse(questionRequest) as QuestionRequest;
            }

            const updatedQuestionRequest = questionRequest as QuestionRequest;
            this.matchService.disablePlayer({
                accessCode: updatedQuestionRequest.matchAccessCode,
                playerName: updatedQuestionRequest.player.name,
            });

            this.server.to(updatedQuestionRequest.matchAccessCode).emit(SocketsEmitEvents.PlayerDisabled, {
                name: updatedQuestionRequest.player.name,
                players: this.matchService.getPlayerFromMatch(updatedQuestionRequest.matchAccessCode, updatedQuestionRequest.player.name),
            });

            const match: Match = this.matchService.getMatchByAccessCode(updatedQuestionRequest.matchAccessCode);
            const playersAnswersList: PlayerAnswers[] = match.getPlayersAnswersList();
            playersAnswersList.forEach((playerAnswer) => {
                if (playerAnswer.name === updatedQuestionRequest.player.name) playerAnswer.isTypingQrl = false;
            });

            this.server.to(updatedQuestionRequest.matchAccessCode).emit(SocketsEmitEvents.AnswerUpdated, playersAnswersList);

            if (
                this.matchService.allPlayersResponded(updatedQuestionRequest.matchAccessCode, updatedQuestionRequest.questionId) &&
                !updatedQuestionRequest.hasQrlEvaluationBegun
            ) {
                this.server.to(updatedQuestionRequest.matchAccessCode).emit(SocketsEmitEvents.AllPlayersResponded, {});
            }

            const matchStartTime = new Date(match.begin);
            const playerLeftTime = new Date(Utils.formatDateToReadable());
            const playerDurationInSeconds = (playerLeftTime.getTime() - matchStartTime.getTime()) / 1000;
            await this.accountService.updateAvgTimePerGame(questionRequest.player.name, playerDurationInSeconds);

            const correctAnswers = match.calculateCorrectAnswers(questionRequest.player.name);
            await this.accountService.updateAvgQuestionsCorrect(questionRequest.player.name, correctAnswers);
            this.logger.log(`Updated average correct answers for player: ${questionRequest.player.name}`);

            await this.accountService.incrementGamesPlayed(questionRequest.player.name);
            client.leave(updatedQuestionRequest.matchAccessCode);
        } catch (error) {
            this.matchService.logger.log('an error occurred', error);
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.ChangeChatAccessibility)
    changeChatAccessibilityHandler(@ConnectedSocket() client: Socket, @MessageBody() data: ChatAccessibilityRequest): void {
        try {
            if (typeof data == 'string') {
                data = JSON.parse(data) as ChatAccessibilityRequest;
            }

            if (this.matchService.getMatchByAccessCode(data.matchAccessCode)) this.matchService.updatePlayersList(data.matchAccessCode, data.players);
        } catch (error) {
            this.matchService.logger.log('chat accessibility not updated in server match');
        }
        this.server.to(data.matchAccessCode).emit(SocketsEmitEvents.ChatAccessibilityChanged, data);
    }

    @SubscribeMessage(SocketsSubscribeEvents.BeginQrlEvaluation)
    beginQrlEvaluation(@ConnectedSocket() client: Socket, @MessageBody() room: Room | string): void {
        if (typeof room === 'string') {
            room = JSON.parse(room) as Room;
        }
        try {
            this.matchService.getMatchByAccessCode(room.id).isEvaluatingQrl = true;
        } catch (error) {
            this.matchService.logger.log('match introuvable');
        }
        this.server.to(room.id).emit(SocketsEmitEvents.QrlEvaluationBegun, {});
    }

    @SubscribeMessage(SocketsSubscribeEvents.FinishQrlEvaluation)
    finishQrlEvaluation(@ConnectedSocket() client: Socket, @MessageBody() room: Room | string): void {
        if (typeof room === 'string') {
            room = JSON.parse(room) as Room;
        }
        try {
            this.matchService.getMatchByAccessCode(room.id).isEvaluatingQrl = false;
        } catch (error) {
            this.matchService.logger.log('match introuvable');
        }
        this.server.to(room.id).emit(SocketsEmitEvents.QrlEvaluationFinished, {});
    }

    @SubscribeMessage(SocketsSubscribeEvents.UpdateMoney)
    async updateMoneyAfterMatch(@ConnectedSocket() client: Socket, @MessageBody() room: { id: string; winnerPlayerName: string }): Promise<void> {
        const arrayIdsAndMoney = await this.accountService.getUserIdAndMoney();
        this.server.to(room.id).emit(SocketsEmitEvents.UpdateMoney, { array: arrayIdsAndMoney, winnerPlayerName: room.winnerPlayerName });
    }

    @SubscribeMessage(SocketsSubscribeEvents.CreateTeam)
    async createTeamHandler(@ConnectedSocket() client: Socket, @MessageBody() data: CreateTeamDto | string): Promise<void> {
        try {
            if (typeof data == 'string') {
                data = JSON.parse(data) as CreateTeamDto;
            }

            const teams: Team[] = this.matchService.createTeam(data);
            this.server.to(data.accessCode).emit(SocketsEmitEvents.TeamCreated, teams);
        } catch (error) {
            this.matchService.logger.error(`Error creating team: ${error.message}`);
            client.emit(SocketsEmitEvents.TeamCreated, { message: 'Failed to create team' });
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.JoinTeam)
    async joinTeamHandler(@ConnectedSocket() client: Socket, @MessageBody() data: CreateTeamDto): Promise<void> {
        try {
            if (typeof data == 'string') {
                data = JSON.parse(data) as CreateTeamDto;
            }

            const teams: Team[] = this.matchService.joinTeam(data);
            this.server.to(data.accessCode).emit(SocketsEmitEvents.TeamJoined, teams);
        } catch (error) {
            this.matchService.logger.error(`Error joining team: ${error.message}`);
            client.emit(SocketsEmitEvents.TeamJoined, { message: 'Failed to join team' });
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.QuitTeam)
    async quitTeamHandler(@ConnectedSocket() client: Socket, @MessageBody() data: CreateTeamDto): Promise<void> {
        try {
            if (typeof data == 'string') {
                data = JSON.parse(data) as CreateTeamDto;
            }

            const teams: Team[] = this.matchService.quitTeam(data);
            this.server.to(data.accessCode).emit(SocketsEmitEvents.TeamQuit, teams);
        } catch (error) {
            this.matchService.logger.error(`Error quitting team: ${error.message}`);
            client.emit(SocketsEmitEvents.TeamQuit, { message: 'Failed to quit team' });
        }
    }

    stopTimer(timerIntervalMap: Map<string, NodeJS.Timer>, accessCode: string): void {
        const interval = timerIntervalMap.get(accessCode);
        if (interval) {
            clearInterval(interval);
            timerIntervalMap.delete(accessCode);
        }
    }

    @SubscribeMessage(SocketsSubscribeEvents.RemoveObserver)
    removeObserver(@ConnectedSocket() client: Socket, @MessageBody() observerRequest: ObserverQuitRequest): void {
        try {
            const observers: Observer[] = this.matchService.removeObserver(observerRequest.accessCode, observerRequest.observerName);

            this.server.to(observerRequest.accessCode).emit(SocketsEmitEvents.ObserverRemoved, observers);
            client.leave(observerRequest.accessCode);
        } catch (error) {
            this.matchService.logger.log('an error occurred', error);
        }
    }

    async leaveAllRoom(roomId: string) {
        const sockets = await this.server.in(roomId).fetchSockets();
        sockets.forEach((socket) => {
            socket.leave(roomId);
        });
    }

    @SubscribeMessage(SocketsSubscribeEvents.GameEvaluation)
    async gameEvaluation(@ConnectedSocket() client: Socket, @MessageBody() data: GameEvaluation): Promise<void> {
        try {
            const game = await this.gameService.getGameById(data.gameId);
            this.logger.debug(data);

            const existingDifficulty = game.difficultyMap?.find((difficulty) => difficulty.key === data.difficulty);
            const existingInterest = game.interestMap?.find((interest) => interest.key === data.interest);
            const existingDuration = game.durationMap?.find((duration) => duration.key === data.duration);
            const existingRating = game.rating?.find((rating) => rating.key === data.rating);

            const newEntryDifficulty = {
                key: data.difficulty,
                value: existingDifficulty ? existingDifficulty.value + 1 : 1,
            };

            const newEntryInterest = {
                key: data.interest,
                value: existingInterest ? existingInterest.value + 1 : 1,
            };

            const newEntryDuration = {
                key: data.duration,
                value: existingDuration ? existingDuration.value + 1 : 1,
            };

            const newEntryRating = {
                key: data.rating,
                value: existingRating ? existingRating.value + 1 : 1,
            };

            await this.gameService.updateGameDifficulty(data.gameId, newEntryDifficulty);
            await this.gameService.updateGameInterest(data.gameId, newEntryInterest);
            await this.gameService.updateGameDuration(data.gameId, newEntryDuration);
            await this.gameService.updateGameRating(data.gameId, newEntryRating);
            console.log(newEntryRating);
        } catch (error) {
            this.matchService.logger.error(`Error game evaluation : ${error}`);
        }
    }

    async sendWinnerNameInRoom(accessCode: string, winnerName: string) {
        this.server.to(accessCode).emit<string>(SocketsEmitEvents.SendWinnerName, winnerName);
    }

    async sendMoneyUpdateInRoom(accessCode: string, winnerPlayerName: string) {
        const arrayIdsAndMoney = await this.accountService.getUserIdAndMoney();
        this.server.to(accessCode).emit(SocketsEmitEvents.UpdateMoney, { array: arrayIdsAndMoney, winnerPlayerName });
    }
}
