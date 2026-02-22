import { ErrorResponse } from '@app/classes/error-response/error-response';
import { CreateMatchDto } from '@app/classes/match/dto/createMatchDto';
import { CurrentMatchesDto } from '@app/classes/match/dto/current-matches.dto';
import { JoinMatchDto } from '@app/classes/match/dto/join-match.dto';
import { Match } from '@app/classes/match/match';
import { Passwords } from '@app/constants/constants';
import { SocketHandlerGateway } from '@app/gateways/socket-handler/socket-handler.gateway';
import { UpdateMatch } from '@app/interfaces/update-match';
import { Validation } from '@app/interfaces/validation';
import { Account, AccountDocument } from '@app/model/database/account';
import { MatchHistory } from '@app/model/database/match-history';
import { AccountService } from '@app/services/account/account.service';
import { MatchService } from '@app/services/match/match.service';
import { Body, Controller, Delete, Get, HttpStatus, Logger, Param, Patch, Post, Res } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiBody, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Model } from 'mongoose';
import { Utils } from 'utils/utils';

/**
 * This file contains all the roads linked to the handling of requests on match
 */
@ApiTags('Matches')
@Controller('matches')
export class MatchController {
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>;

    constructor(
        private readonly matchService: MatchService,
        private readonly accountService: AccountService,
        private readonly logger: Logger,
        private readonly socketHandler: SocketHandlerGateway,
    ) {}

    // @Get('/')
    // @ApiOkResponse({
    //     description: 'Return the list of all matchs',
    //     type: Match,
    //     isArray: true,
    // })
    // @ApiNotFoundResponse({
    //     description: 'Return NOT_FOUND http status when request fails',
    // })
    // getAllMatches(@Res() res: Response) {
    //     try {

    //         res.status(HttpStatus.OK).json(this.matchService.matches);
    //     } catch (error) {
    //         res.status(HttpStatus.NOT_FOUND).send(error.message);
    //     }
    // }

    @Get('/')
    @ApiOkResponse({
        description: 'Return a list of current matches with limited details',
        type: CurrentMatchesDto,
        isArray: true,
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    getCurrentMatches(@Res() res: Response) {
        try {
            this.logger.log('Getting match list');
            const matches: CurrentMatchesDto[] = this.matchService.matches.map((match) => ({
                accessCode: match.accessCode,
                quizName: match.game.title,
                quizNameEn: match.game.titleEn,
                playersCount: match.players.length,
                observersCount: match.observers.length,
                hasStarted: match.begin.trim() !== '',
                isAccessible: match.isAccessible,
                managerName: match.managerName,
                managerId: match.managerId,
                isFriendMatch: match.isFriendMatch,
                isPricedMatch: match.isPricedMatch,
                players: match.players,
                priceMatch: match.priceMatch,
            }));

            res.status(HttpStatus.OK).json(matches);
        } catch (error) {
            res.status(HttpStatus.NOT_FOUND).send(error.message);
        }
    }

    @Post('/join-match')
    @ApiBody({
        description: 'The access code and player name to join a match',
        type: JoinMatchDto,
    })
    @ApiOkResponse({
        description: 'Join a match by validating the access code, accessibility, and player name',
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status and the right error messages in french and english when request fails',
        type: ErrorResponse,
    })
    async joinMatch(@Body() joinMatchDto: JoinMatchDto | string, @Res() res: Response) {
        try {
            if (typeof joinMatchDto === 'string') {
                joinMatchDto = JSON.parse(joinMatchDto) as JoinMatchDto;
            }

            const { accessCode, playerName } = joinMatchDto;

            const isAccessCodeValid = this.matchService.accessCodeExists(accessCode);
            if (!isAccessCodeValid) {
                return res.status(HttpStatus.NOT_FOUND).json({
                    error: {
                        fr: 'Code d’accès invalide ou la partie a été annulée par l’organisateur',
                        en: 'Invalid access code or the match has been cancelled by the organizer',
                    },
                });
            }

            const isAccessible = this.matchService.isAccessible(accessCode);
            if (!isAccessible) {
                return res.status(HttpStatus.FORBIDDEN).json({
                    error: {
                        fr: 'La partie a été verrouillée par l’organisateur',
                        en: 'The match has been locked by the organizer',
                    },
                });
            }

            const isPlayerNameValid = this.matchService.isPlayerNameValidForGame({ accessCode, name: playerName });
            if (!isPlayerNameValid) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    error: {
                        fr: 'Vous avez été bloqué de la partie par l’organisateur',
                        en: 'You have been blocked from the match by the organizer',
                    },
                });
            }

            return res.status(HttpStatus.OK).json({ message: 'Successfully joined match' });
        } catch (error) {
            this.logger.log('An error occurred while joining the match', error);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
        }
    }

    @Get('/match/validity/:accessCode')
    @ApiOkResponse({
        description: 'Return access code validity',
        type: Boolean,
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    accessCodeExists(@Param('accessCode') accessCode: string, @Res() res: Response) {
        try {
            const accessCodeExists = this.matchService.accessCodeExists(accessCode);
            res.status(HttpStatus.OK).json(accessCodeExists);
        } catch (e) {
            this.logger.log('an error occurred', e);
            res.status(HttpStatus.NOT_FOUND).send(e.message);
        }
    }

    @Get('/match/accessibility/:accessCode')
    @ApiOkResponse({
        description: 'Return match accessibility status',
        type: Boolean,
    })
    isAccessible(@Param('accessCode') accessCode: string, @Res() res: Response) {
        try {
            const isAccessible: boolean = this.matchService.isAccessible(accessCode);
            res.status(HttpStatus.OK).json(isAccessible);
        } catch (e) {
            this.logger.log('an error occurred', e);
            res.status(HttpStatus.NOT_FOUND).send(e.message);
        }
    }

    @Get('/match/:accessCode')
    @ApiOkResponse({
        description: 'Return match',
        type: Match,
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    getMatchByAccessCode(@Param('accessCode') accessCode: string, @Res() res: Response) {
        try {
            const match: Match | undefined = this.matchService.getMatchByAccessCode(accessCode);
            if (match) res.status(HttpStatus.OK).json(match);
            else res.status(HttpStatus.NOT_FOUND).send('Match not found');
        } catch (e) {
            this.logger.log('an error occurred', e);
            res.status(HttpStatus.NOT_FOUND).send(e.message);
        }
    }

    @Post('/match/playerNameValidity')
    @ApiOkResponse({
        description: 'Return player name existence',
        type: Boolean,
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    isPlayerNameValidForGame(@Body() bodyMessage: Validation, @Res() res: Response) {
        try {
            const isPlayerNameValidForGame: boolean = this.matchService.isPlayerNameValidForGame(bodyMessage);
            res.status(HttpStatus.OK).json(isPlayerNameValidForGame);
        } catch (e) {
            this.logger.log('an error occurred', e);
            res.status(HttpStatus.NOT_FOUND).send(e.message);
        }
    }

    @Delete('/match/:accessCode')
    @ApiOkResponse({
        description: 'Delete a match when it is over',
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND HTTP status when request fails',
    })
    async deleteMatchByAccessCode(@Param('accessCode') accessCode: string, @Res() res: Response) {
        try {
            this.logger.log(`Received request to delete match with accessCode: ${accessCode}`);
            let winnerPlayerName = '';

            const match: Match = this.matchService.getMatchByAccessCode(accessCode);
            if (!match) {
                this.logger.warn(`Match with accessCode ${accessCode} not found`);
                return res.status(HttpStatus.NOT_FOUND).send('Match not found');
            }

            this.logger.log(`Match with accessCode ${accessCode} found. Proceeding with deletion...`);

            this.matchService.deleteMatchByAccessCode(accessCode);

            const matchStartTime = new Date(match.begin);
            const matchEndTime = new Date(Utils.formatDateToReadable());
            const matchDurationInSeconds = (matchEndTime.getTime() - matchStartTime.getTime()) / 1000;

            console.log(match.begin);

            if (match.players.length === 0 || !match.begin) {
                this.logger.log(`No players joined the match with accessCode: ${accessCode}. Skipping player statistics update.`);
            } else {
                await Promise.all(
                    match.players.map(async (player) => {
                        const playername = player.name;

                        if (player.isActive) {
                            this.logger.log(`Processing statistics for player: ${playername}`);
                            const correctAnswers = match.calculateCorrectAnswers(playername);
                            await this.accountService.updateAvgQuestionsCorrect(playername, correctAnswers);
                            this.logger.log(`Updated average correct answers for player: ${playername}`);
                            await this.accountService.updateAvgTimePerGame(playername, matchDurationInSeconds);
                            this.logger.log(`Updated average time per game for active player: ${playername}`);
                            await this.accountService.incrementGamesPlayed(playername);
                        }

                        await this.accountService.incrementGamesPlayed(playername);

                        let won = false;
                        if (match.isTeamMatch) {
                            won = playername in match.getWinnerTeam().players;
                        } else {
                            won = playername === match.getBestPlayer();
                        }
                        const gameName = match.game.title;

                        if (won) {
                            winnerPlayerName = playername;
                            if (match.isPricedMatch) {
                                this.logger.log(
                                    `Incrementing money for winner ${playername} based on active players in priced match with accessCode: ${accessCode}`,
                                );

                                const activePlayersCount = match.players.filter((player) => player.isActive).length;

                                if (activePlayersCount <= 0) {
                                    this.logger.warn('No active players in the match. Skipping prize distribution.');
                                } else {
                                    const incrementAmountWinner = Math.round(Math.floor(match.nbPlayersJoined * match.priceMatch) * (2 / 3));
                                    this.logger.log(`Calculated increment amount: ${incrementAmountWinner} for player: ${playername}`);

                                    const updatedAccount = await this.accountModel.findOneAndUpdate(
                                        { pseudonym: playername },
                                        { $inc: { money: incrementAmountWinner + 100 } },
                                        { new: true },
                                    );

                                    if (!updatedAccount) {
                                        this.logger.warn(`Account with pseudonym ${playername} not found. Skipping prize distribution.`);
                                    } else {
                                        this.logger.log(
                                            `Successfully incremented money for winner ${playername} with amount ${incrementAmountWinner}`,
                                        );
                                    }
                                }
                            } else {
                                await this.accountService.incrementMoneyWinner(playername);
                            }
                        } else {
                            if (match.isPricedMatch) {
                                this.logger.log(
                                    `Incrementing money for loser ${playername} based on active players in priced match with accessCode: ${accessCode}`,
                                );

                                const activePlayersCount = match.players.filter((player) => player.isActive).length;

                                if (activePlayersCount <= 0) {
                                    this.logger.warn('No active players in the match. Skipping prize distribution.');
                                } else {
                                    const incrementAmountLoser = Math.round(
                                        (Math.floor(match.nbPlayersJoined * match.priceMatch) * (1 / 3)) / (activePlayersCount - 1),
                                    );
                                    this.logger.log(`Calculated increment amount: ${incrementAmountLoser} for player: ${playername}`);

                                    const updatedAccount = await this.accountModel.findOneAndUpdate(
                                        { pseudonym: playername },
                                        { $inc: { money: incrementAmountLoser + 50 } },
                                        { new: true },
                                    );

                                    if (!updatedAccount) {
                                        this.logger.warn(`Account with pseudonym ${playername} not found. Skipping prize distribution.`);
                                    } else {
                                        this.logger.log(`Successfully incremented money for loser ${playername} with amount ${incrementAmountLoser}`);
                                    }
                                }
                            } else await this.accountService.incrementMoneyLoser(playername);
                        }

                        await this.accountService.updateMatchHistory(playername, {
                            gameName,
                            datePlayed: match.begin,
                            won,
                        });
                        this.logger.log(`Match history updated for player: ${playername}`);
                    }),
                );

                const bestPlayer = match.getBestPlayer();
                if (bestPlayer) {
                    await this.accountService.incrementGamesWon(bestPlayer);
                    this.logger.log(`Incremented games won for best player: ${bestPlayer}`);
                } else {
                    this.logger.warn(`No best player found for match with accessCode: ${accessCode}`);
                }
            }
            await this.socketHandler.sendMoneyUpdateInRoom(match.accessCode, winnerPlayerName);
            this.socketHandler.sendWinnerNameInRoom(match.accessCode, winnerPlayerName);
            this.socketHandler.leaveAllRoom(accessCode);
            res.status(HttpStatus.OK).json({ winnerPlayerName });
            this.logger.log(`Match with accessCode ${accessCode} deleted successfully`);
        } catch (error) {
            this.logger.error(`Error occurred while deleting match with accessCode ${accessCode}: ${error.message}`);
            res.status(HttpStatus.NOT_FOUND).send(error.message);
        }
    }

    @Delete('/')
    @ApiOkResponse({
        description: 'delete all matches to clear server',
    })
    @ApiNotFoundResponse({
        description: 'Return UNAUTHORIZED http status when password is incorrect or INTERNAL_SERVER_ERROR if the request failed',
    })
    deleteAllMatches(@Body() identifier: { password: string }, @Res() res: Response) {
        try {
            if (identifier.password === Passwords.DeleteAllMatches) {
                this.matchService.deleteAllMatches();
                res.status(HttpStatus.OK).send();
            } else res.status(HttpStatus.UNAUTHORIZED).send('Bad password');
        } catch (error) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error.message);
        }
    }

    @Post('/match/')
    @ApiOkResponse({
        description: 'create a new match',
    })
    @ApiNotFoundResponse({
        description: 'Return INTERNAL_SERVER_ERROR http status when the request failed',
    })
    createMatch(@Body() createMatchDto: CreateMatchDto, @Res() res: Response) {
        try {
            const match: Match = this.matchService.createMatch(createMatchDto);
            console.log(match);
            res.status(HttpStatus.CREATED).send(match);
        } catch (e) {
            this.logger.log('an error occurred', e);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(e.message);
        }
    }

    @Patch('/match/accessibility/:accessCode')
    @ApiOkResponse({
        description: 'modify match accessibility',
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    setAccessibility(@Param('accessCode') accessCode: string, @Res() response: Response) {
        try {
            this.matchService.setAccessibility(accessCode);
            response.status(HttpStatus.OK).send();
        } catch (error) {
            response.status(HttpStatus.NOT_FOUND).send(error.message);
        }
    }

    @Post('/match/player')
    @ApiOkResponse({
        description: 'add a player to match player list',
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    addPlayer(@Body() updateData: UpdateMatch, @Res() response: Response) {
        try {
            this.matchService.addPlayer(updateData);
            response.status(HttpStatus.OK).send();
        } catch (error) {
            response.status(HttpStatus.NOT_FOUND).send(error.message);
        }
    }

    @Post('/match/:accessCode/history')
    @ApiOkResponse({
        description: 'Validate and save match history',
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    async saveHistory(@Param('accessCode') accessCode: string, @Res() response: Response) {
        try {
            const match = this.matchService.getMatchByAccessCode(accessCode);
            await this.matchService.saveMatchHistory(match.getMatchHistory());
            response.status(HttpStatus.OK).send();
        } catch (error) {
            response.status(HttpStatus.NOT_FOUND).send(error.message);
        }
    }

    @Get('/history')
    @ApiOkResponse({
        description: 'Return the match history',
        type: MatchHistory,
        isArray: true,
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    async getMatchHistory(@Res() res: Response) {
        try {
            res.status(HttpStatus.OK).json(await this.matchService.getMatchHistory());
        } catch (error) {
            res.status(HttpStatus.NOT_FOUND).send(error.message);
        }
    }

    @Delete('/history')
    @ApiOkResponse({
        description: 'delete match history',
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when the request failed',
    })
    deleteMatchHistory(@Res() res: Response) {
        try {
            this.matchService.deleteMatchHistory();
            res.status(HttpStatus.OK).send();
        } catch (error) {
            res.status(HttpStatus.NOT_FOUND).send(error.message);
        }
    }
}
