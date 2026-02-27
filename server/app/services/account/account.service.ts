import { Language, ThemeVisual } from '@app/constants/constants';
import { FriendHandlerGateway } from '@app/gateways/friend-handler/friend-handler';
import { Account, AccountDocument } from '@app/model/database/account';
import { Friend } from '@app/model/database/friend';
import { CreateAccountDTO } from '@app/model/dto/account/create-account.dto';
import { FriendRequestDto } from '@app/model/dto/friend-request/friend-request-dto';
import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { ClientSession, Model } from 'mongoose';

@Injectable()
export class AccountService {
    constructor(
        @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
        private readonly logger: Logger,
        private readonly friendHandlerGateway: FriendHandlerGateway,
        private readonly configService: ConfigService,
    ) {}

    async findAll(): Promise<Account[]> {
        this.logger.log('Fetching all accounts');
        return this.accountModel.find().exec();
    }

    async findByUserId(userId: string): Promise<Account | null> {
        this.logger.log(`Getting user by userId = ${userId}`);
        const account = await this.accountModel.findOne({ userId }).exec();
        if (!account) {
            throw new NotFoundException(`Account with userId ${userId} not found`);
        }
        return account;
    }

    async findByUserPseudonym(pseudonym: string): Promise<Account | null> {
        this.logger.log(`Getting user by pseudonym = ${pseudonym}`);
        const account = await this.accountModel.findOne({ pseudonym }).exec();
        if (!account) {
            throw new NotFoundException(`Account with pseudonym ${pseudonym} not found`);
        }
        return account;
    }

    async findByUserName(userName: string): Promise<Account> {
        this.logger.log(`Getting account by pseudonym = ${userName}`);
        const account = await this.accountModel.findOne({ pseudonym: userName }).exec();

        if (!account) {
            this.logger.error(`Account with pseudonym ${userName} not found`);
            throw new NotFoundException(`Account with pseudonym ${userName} not found`);
        }

        return account;
    }

    async getFriends(userId: string): Promise<string[]> {
        const account = await this.findByUserId(userId);
        const friendsIds = account.friends;
        return Promise.all(friendsIds);
    }

    async findAllBasicInfo(): Promise<Partial<Account>[]> {
        this.logger.log('Fetching basic info for all accounts');
        return this.accountModel.find().select('userId pseudonym avatarUrl').exec();
    }

    async findBasicInfoByUserId(userId: string): Promise<Partial<Account>> {
        this.logger.log(`Getting basic info by userId = ${userId}`);
        return this.accountModel.findOne({ userId }).select('userId pseudonym avatarUrl').exec();
    }

    async getFriendRequests(userId: string): Promise<FriendRequestDto[]> {
        const account = await this.findByUserId(userId);
        const friendRequests = account.friendRequests;
        return Promise.all(friendRequests);
    }

    /**
     * Updates account-side request projections for both participants:
     * - sender: append receiver to `friendsThatUserRequested`
     * - receiver: append request object to `friendRequests`
     *
     * Canonical request storage still lives in friend collection.
     */
    async addFriendRequest(userId: string, senderBasicInfo: Partial<Account>, requestId: string, session?: ClientSession): Promise<void> {
        // Get all information related to the friend request
        const friendRequest: FriendRequestDto = new FriendRequestDto();
        friendRequest.requestId = requestId;
        friendRequest.senderBasicInfo = senderBasicInfo;

        // Add the receiverId to the list of friends that the sender has requested (In sender account)
        const senderAccountUpdate = await this.accountModel.findOneAndUpdate(
            { userId: senderBasicInfo.userId },
            { $addToSet: { friendsThatUserRequested: userId } },
            this.buildQueryOptions({ friendsThatUserRequested: 1 }, session),
        );

        // Push projection update to sender in real-time.
        this.friendHandlerGateway.emitFriendRequestsSentUpdated(senderBasicInfo.userId, senderAccountUpdate?.friendsThatUserRequested || []);

        // Add the friend request to the receiver's account
        const receiverAccountUpdate = await this.accountModel
            .findOneAndUpdate({ userId }, { $addToSet: { friendRequests: friendRequest } }, this.buildQueryOptions({ friendRequests: 1 }, session))
            .exec();

        const friendRequestsListUpdated = receiverAccountUpdate?.friendRequests || [];
        // Push projection update to receiver in real-time.
        this.friendHandlerGateway.emitFriendRequestsReceivedUpdated(userId, friendRequestsListUpdated);
    }

    /**
     * Removes request projections from both participants.
     * Used by reject, cancel and block-with-pending-request flows.
     */
    async removeFriendRequestFromAccount(request: Friend, session?: ClientSession): Promise<void> {
        const accountReceiver = await this.accountModel.findOneAndUpdate(
            { userId: request.receiverId },
            { $pull: { friendRequests: { requestId: request.requestId } } },
            this.buildQueryOptions({ friendRequests: 1 }, session),
        );
        const friendRequestsReceiverListUpdated = accountReceiver?.friendRequests || [];
        this.friendHandlerGateway.emitFriendRequestsReceivedUpdated(request.receiverId, friendRequestsReceiverListUpdated);

        // Keep sender-side "requested list" in sync with receiver-side request removal.
        const accountSender = await this.accountModel.findOneAndUpdate(
            { userId: request.senderId },
            { $pull: { friendsThatUserRequested: request.receiverId } },
            this.buildQueryOptions({ friendsThatUserRequested: 1 }, session),
        );
        const friendsThatUserRequestedUpdated = accountSender?.friendsThatUserRequested || [];
        this.friendHandlerGateway.emitFriendRequestsSentUpdated(request.senderId, friendsThatUserRequestedUpdated);
    }

    /**
     * Materializes an accepted friendship into account projections and
     * clears request-specific projection arrays.
     */
    async addFriend(request: Friend, session?: ClientSession): Promise<void> {
        const receiverAccount = await this.accountModel.findOneAndUpdate(
            { userId: request.receiverId },
            { $addToSet: { friends: request.senderId } },
            this.buildQueryOptions({ friends: 1 }, session),
        );

        const senderAccount = await this.accountModel.findOneAndUpdate(
            { userId: request.senderId },
            { $addToSet: { friends: request.receiverId } },
            this.buildQueryOptions({ friends: 1 }, session),
        );

        this.friendHandlerGateway.emitFriendsUpdated(request.receiverId, receiverAccount?.friends || []);
        this.friendHandlerGateway.emitFriendsUpdated(request.senderId, senderAccount?.friends || []);

        // Remove the friend request from the receiver's account
        const receiverAccountUpdate = await this.accountModel.findOneAndUpdate(
            { userId: request.receiverId },
            { $pull: { friendRequests: { requestId: request.requestId } } },
            this.buildQueryOptions({ friendRequests: 1 }, session),
        );

        const friendRequestsListUpdated = receiverAccountUpdate?.friendRequests || [];
        this.friendHandlerGateway.emitFriendRequestsReceivedUpdated(request.receiverId, friendRequestsListUpdated);

        // Remove the id of receiver from the list of friends that the sender has requested (In sender account)
        const senderAccountUpdate = await this.accountModel.findOneAndUpdate(
            { userId: request.senderId },
            { $pull: { friendsThatUserRequested: request.receiverId } },
            this.buildQueryOptions({ friendsThatUserRequested: 1 }, session),
        );

        const friendsThatUserRequestedUpdated = senderAccountUpdate?.friendsThatUserRequested || [];
        this.friendHandlerGateway.emitFriendRequestsSentUpdated(request.senderId, friendsThatUserRequestedUpdated);
    }

    async getFriendsThatUserRequested(userId: string): Promise<string[]> {
        const account = await this.findByUserId(userId);
        const friendsThatUserRequested = account.friendsThatUserRequested;
        return Promise.all(friendsThatUserRequested);
    }

    /**
     * Removes both sides of a friendship relation from account projections.
     */
    async removeFriend(request: Friend, session?: ClientSession): Promise<void> {
        const senderAccount = await this.accountModel.findOneAndUpdate(
            { userId: request.senderId },
            { $pull: { friends: request.receiverId } },
            this.buildQueryOptions({ friends: 1 }, session),
        );

        if (!senderAccount) {
            throw new BadRequestException('Remove Friend: Sender of friend request not found');
        }

        const receiverAccount = await this.accountModel.findOneAndUpdate(
            { userId: request.receiverId },
            { $pull: { friends: request.senderId } },
            this.buildQueryOptions({ friends: 1 }, session),
        );

        if (!receiverAccount) {
            throw new BadRequestException('Remove Friend: Receiver of friend request not found');
        }

        this.friendHandlerGateway.emitFriendsUpdated(request.receiverId, receiverAccount?.friends || []);
        this.friendHandlerGateway.emitFriendsUpdated(request.senderId, senderAccount?.friends || []);
    }
    async findByUserIds(userIds: string[]): Promise<Partial<Account>[]> {
        this.logger.log(`Getting accounts by userIds = ${userIds.join(', ')}`);
        const accounts = await this.accountModel.find({ userId: { $in: userIds } }).exec();

        if (!accounts || accounts.length === 0) {
            throw new NotFoundException('No accounts found for the provided userIds');
        }

        return accounts.map((account) => ({
            userId: account.userId,
            pseudonym: account.pseudonym,
            avatarUrl: account.avatarUrl,
        }));
    }

    /**
     * Creates bi-directional block projections:
     * - blocker.UsersBlocked += blocked user
     * - blocked.UsersBlockingMe += blocker
     */
    async addToBlockList(userId: string, blockedPersonId: string, session?: ClientSession): Promise<void> {
        const user = await this.accountModel.findOneAndUpdate(
            { userId },
            { $addToSet: { UsersBlocked: blockedPersonId } },
            this.buildQueryOptions({ UsersBlocked: 1 }, session),
        );

        const blockedPerson = await this.accountModel.findOneAndUpdate(
            { userId: blockedPersonId },
            { $addToSet: { UsersBlockingMe: userId } },
            this.buildQueryOptions({ UsersBlockingMe: 1 }, session),
        );

        this.friendHandlerGateway.emitBlockedUsersUpdated(userId, user?.UsersBlocked || []);
        this.friendHandlerGateway.emitBlockedByUsersUpdated(blockedPersonId, blockedPerson?.UsersBlockingMe || []);
    }

    /**
     * Removes bi-directional block projections.
     */
    async removeFromBlockList(userId: string, blockedPersonId: string, session?: ClientSession): Promise<void> {
        const user = await this.accountModel.findOneAndUpdate(
            { userId },
            { $pull: { UsersBlocked: blockedPersonId } },
            this.buildQueryOptions({ UsersBlocked: 1 }, session),
        );

        const unblockedPerson = await this.accountModel.findOneAndUpdate(
            { userId: blockedPersonId },
            { $pull: { UsersBlockingMe: userId } },
            this.buildQueryOptions({ UsersBlockingMe: 1 }, session),
        );

        this.friendHandlerGateway.emitBlockedUsersUpdated(userId, user?.UsersBlocked || []);
        this.friendHandlerGateway.emitBlockedByUsersUpdated(blockedPersonId, unblockedPerson?.UsersBlockingMe || []);
    }

    // Read model endpoint: users this account has blocked.
    async getBlockedUsers(userId: string): Promise<string[]> {
        const account = await this.findByUserId(userId);
        const blockedUsers = account.UsersBlocked;
        return Promise.all(blockedUsers);
    }

    // Read model endpoint: users that currently block this account.
    async getBlockedByUsers(userId: string): Promise<string[]> {
        const account = await this.findByUserId(userId);
        const blockedByUsers = account.UsersBlockingMe;
        return Promise.all(blockedByUsers);
    }

    async updateLanguage(userId: string, lang: Language): Promise<Account> {
        this.logger.log(`Updating language for userId ${userId} to ${lang}`);
        const updatedAccount = await this.accountModel.findOneAndUpdate({ userId }, { lang }, { new: true });
        if (!updatedAccount) {
            throw new Error(`Account with userId ${userId} not found`);
        }
        return updatedAccount;
    }

    async updateTheme(userId: string, themeVisual: ThemeVisual): Promise<Account> {
        this.logger.log(`Updating themeVisual for userId ${userId} to ${themeVisual}`);
        const updatedAccount = await this.accountModel.findOneAndUpdate({ userId }, { themeVisual }, { new: true });
        if (!updatedAccount) {
            throw new Error(`Account with userId ${userId} not found`);
        }
        return updatedAccount;
    }

    async createAccount(createAccountDto: CreateAccountDTO): Promise<Account> {
        this.logger.log('Creating a new account');
        const newAccount = new this.accountModel(createAccountDto);
        return newAccount.save();
    }

    /**
     * Create MongoDB account from Auth0 user (idempotent).
     * Called by Auth0 Action on login/signup so the app has a matching account.
     */
    async syncAccountFromAuth0(userId: string, email: string, pseudonym?: string): Promise<Account> {
        const existing = await this.accountModel.findOne({ userId }).exec();
        if (existing) {
            this.logger.log(`Account already exists for userId ${userId}, skipping sync`);
            return existing;
        }
        const displayName = pseudonym?.trim() || email.split('@')[0] || 'User';
        const createDto: CreateAccountDTO = {
            userId,
            pseudonym: displayName,
            email,
            avatarUrl: null,
            themeVisual: ThemeVisual.LIGHT,
            lang: Language.EN,
            gamesPlayed: 0,
            gamesWon: 0,
            avgQuestionsCorrect: 0,
            avgTimePerGame: 0,
            money: 0,
            ownedThemes: [],
            ownedAvatars: [],
            friends: [],
            friendRequests: [],
            friendsThatUserRequested: [],
            blocked: [],
            UsersBlocked: [],
            UsersBlockingMe: [],
        };
        this.logger.log(`Syncing new account from Auth0: userId=${userId}, pseudonym=${displayName}`);
        return this.createAccount(createDto);
    }

    async updateAvatar(userId: string, avatarUrl: string): Promise<Account> {
        this.logger.log(`Updating avatar for userId ${userId}`);
        const updatedAccount = await this.accountModel.findOneAndUpdate({ userId }, { avatarUrl }, { new: true });
        if (!updatedAccount) {
            throw new Error(`Account with userId ${userId} not found`);
        }
        return updatedAccount;
    }

    async updateMoney(userId: string, money: number): Promise<Account> {
        this.logger.log(`Updating money for userId ${userId}`);
        const updatedAccount = await this.accountModel.findOneAndUpdate({ userId }, { money }, { new: true });
        if (!updatedAccount) {
            throw new Error(`Account with userId ${userId} not found`);
        }
        return updatedAccount;
    }

    async updateOwnedThemes(userId: string, ownedThemes: ThemeVisual[]): Promise<Account> {
        this.logger.log(`Received userId: ${userId}`);
        this.logger.log(`Received ownedThemes: ${JSON.stringify(ownedThemes)}`);

        if (!Array.isArray(ownedThemes)) {
            throw new Error('ownedThemes must be an array');
        }

        const updatedAccount = await this.accountModel.findOneAndUpdate(
            { userId },
            { $addToSet: { visualThemesOwned: { $each: ownedThemes } } },
            { new: true },
        );

        if (!updatedAccount) {
            throw new Error(`Account with userId ${userId} not found`);
        }

        return updatedAccount;
    }

    async updateOwnedAvatars(userId: string, ownedAvatars: string[]): Promise<Account> {
        this.logger.log(`Received userId: ${userId}`);
        this.logger.log(`Received ownedThemes: ${JSON.stringify(ownedAvatars)}`);

        if (!Array.isArray(ownedAvatars)) {
            throw new Error('ownedThemes must be an array');
        }

        const updatedAccount = await this.accountModel.findOneAndUpdate(
            { userId },
            { $addToSet: { avatarsUrlOwned: { $each: ownedAvatars } } },
            { new: true },
        );

        if (!updatedAccount) {
            throw new Error(`Account with userId ${userId} not found`);
        }

        return updatedAccount;
    }

    async incrementGamesPlayed(pseudonym: string): Promise<Account> {
        this.logger.log(`Incrementing gamesPlayed for userId ${pseudonym}`);
        const updatedAccount = await this.accountModel.findOneAndUpdate({ pseudonym }, { $inc: { gamesPlayed: 1 } }, { new: true });
        if (!updatedAccount) {
            throw new Error(`Account with userId ${pseudonym} not found`);
        }
        return updatedAccount;
    }

    async incrementGamesWon(pseudonym: string): Promise<Account> {
        this.logger.log(`Incrementing gamesWon for userId ${pseudonym}`);

        const updatedAccount = await this.accountModel.findOneAndUpdate({ pseudonym }, { $inc: { gamesWon: 1 } }, { new: true });
        if (!updatedAccount) {
            throw new Error(`Account with userName ${pseudonym} not found`);
        }
        return updatedAccount;
    }

    async incrementMoneyWinner(pseudonym: string): Promise<Account> {
        this.logger.log(`Incrementing money for winner userId ${pseudonym}`);
        const updatedAccount = await this.accountModel.findOneAndUpdate({ pseudonym }, { $inc: { money: 100 } }, { new: true });
        if (!updatedAccount) {
            throw new Error(`Account with userName ${pseudonym} not found`);
        }
        return updatedAccount;
    }

    // async incrementMoneyWinnerPricedGame(pseudonym: string, matchAccessCode: string): Promise<Account> {
    //     this.logger.log(`Incrementing money for winner userId ${pseudonym} based on active players in match ${matchAccessCode}`);

    //     const match = this.matchService.getMatchByAccessCode(matchAccessCode);
    //     const activePlayersCount = match.players.filter(player => player.isActive).length;

    //     if (activePlayersCount <= 0) {
    //         throw new Error('No active players in the match. Cannot distribute winnings.');
    //     }

    //     const incrementAmount = ((match.nbPlayersJoined*10)*(2/3));
    //     this.logger.log(`Incrementing money for winner userId ${pseudonym}`, `${incrementAmount}`);

    //     const updatedAccount = await this.accountModel.findOneAndUpdate(
    //         { pseudonym },
    //         { $inc: { money: incrementAmount } },
    //         { new: true }
    //     );

    //     if (!updatedAccount) {
    //         throw new Error(`Account with userName ${pseudonym} not found`);
    //     }

    //     return updatedAccount;
    // }

    // async incrementMoneyLosersPricedGame(pseudonym: string, matchAccessCode: string): Promise<Account> {
    //     this.logger.log(`Incrementing money for winner userId ${pseudonym} based on active players in match ${matchAccessCode}`);

    //     const match = this.matchService.getMatchByAccessCode(matchAccessCode);
    //     const activePlayersCount = match.players.filter(player => player.isActive).length;

    //     if (activePlayersCount <= 0) {
    //         throw new Error('No active players in the match. Cannot distribute winnings.');
    //     }

    //     const incrementAmount = ((match.nbPlayersJoined*10)*(1/3) / activePlayersCount);
    //     this.logger.log(`Incrementing money for loser userId ${pseudonym}`, `${incrementAmount}`);

    //     const updatedAccount = await this.accountModel.findOneAndUpdate(
    //         { pseudonym },
    //         { $inc: { money: incrementAmount } },
    //         { new: true }
    //     );

    //     if (!updatedAccount) {
    //         throw new Error(`Account with userName ${pseudonym} not found`);
    //     }

    //     return updatedAccount;
    // }

    async incrementMoneyLoser(pseudonym: string): Promise<Account> {
        this.logger.log(`Incrementing money for loser userId ${pseudonym}`);
        const updatedAccount = await this.accountModel.findOneAndUpdate({ pseudonym }, { $inc: { money: 50 } }, { new: true });
        if (!updatedAccount) {
            throw new Error(`Account with userName ${pseudonym} not found`);
        }
        return updatedAccount;
    }

    async updateAvgQuestionsCorrect(pseudonym: string, correctAnswers: number): Promise<Account> {
        this.logger.log(`Updating avgQuestionsCorrect for userId ${pseudonym}`);

        const account = await this.accountModel.findOne({ pseudonym });

        if (!account) {
            throw new Error(`Account with pseudonym ${pseudonym} not found`);
        }

        const previousAverage = account.avgQuestionsCorrect;
        const totalGamesPlayed = account.gamesPlayed;

        const newOverallAverage = Math.round(((previousAverage * totalGamesPlayed + correctAnswers) / (totalGamesPlayed + 1)) * 100) / 100;

        const updatedAccount = await this.accountModel.findOneAndUpdate(
            { pseudonym },
            {
                avgQuestionsCorrect: newOverallAverage,
            },
            { new: true },
        );

        if (!updatedAccount) {
            throw new Error(`Account with pseudonym ${pseudonym} not found`);
        }

        return updatedAccount;
    }

    async updateAvgTimePerGame(pseudonym: string, newGameTime: number): Promise<Account> {
        this.logger.log(`Updating avgTimePerGame for pseudonym ${pseudonym}`);
        const account = await this.accountModel.findOne({ pseudonym });

        if (!account) {
            throw new Error(`Account with pseudonym ${pseudonym} not found`);
        }

        const previousAverage = account.avgTimePerGame;
        const totalGamesPlayed = account.gamesPlayed;

        const newOverallAverage = Math.round(((previousAverage * totalGamesPlayed + newGameTime) / (totalGamesPlayed + 1)) * 100) / 100;

        const updatedAccount = await this.accountModel.findOneAndUpdate(
            { pseudonym },
            {
                avgTimePerGame: newOverallAverage,
            },
            { new: true },
        );

        if (!updatedAccount) {
            throw new Error(`Account with pseudonym ${pseudonym} not found`);
        }

        return updatedAccount;
    }

    async updateMatchHistory(pseudonym: string, matchData: { gameName: string; datePlayed: string; won: boolean }): Promise<Account> {
        this.logger.log(`Updating match history for pseudonym ${pseudonym}`);

        const updatedAccount = await this.accountModel.findOneAndUpdate({ pseudonym }, { $push: { matchHistory: matchData } }, { new: true });

        if (!updatedAccount) {
            throw new Error(`Account with pseudonym ${pseudonym} not found`);
        }

        return updatedAccount;
    }

    async updatePseudonym(userId: string, newPseudonym: string): Promise<Account> {
        this.logger.log(`Updating pseudonym for userId ${userId} to ${newPseudonym}`);

        const existingAccount = await this.accountModel.findOne({ pseudonym: newPseudonym }).exec();
        if (existingAccount) {
            throw new BadRequestException({
                error: {
                    en: `The pseudonym "${newPseudonym}" is already in use.`,
                    fr: `Le pseudonyme "${newPseudonym}" est déjà utilisé.`,
                },
            });
        }

        try {
            const accessToken = await this.getAuth0AccessToken();
            const auth0Domain = this.configService.get<string>('AUTH0_DOMAIN')?.replace(/\/$/, '') || '';
            await axios.patch(
                `${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}`,
                { username: newPseudonym },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
        } catch (error) {
            this.logger.error(`Failed to update username in Auth0: ${error.message}`);
            this.logger.error(`Auth0 response status: ${error.response?.status}`);
            this.logger.error(`Auth0 response body: ${JSON.stringify(error.response?.data)}`);
            this.logger.error(`Auth0 request URL: ${error.config?.url}`);
            throw new BadRequestException({
                error: {
                    en: 'Failed to update username in Auth0',
                    fr: "Impossible de mettre \u00e0 jour le nom d'utilisateur dans Auth0",
                },
            });
        }

        const updatedAccount = await this.accountModel.findOneAndUpdate({ userId }, { pseudonym: newPseudonym }, { new: true });

        if (!updatedAccount) {
            throw new NotFoundException({
                error: {
                    en: `Account with userId ${userId} not found.`,
                    fr: `Compte avec l'ID utilisateur ${userId} introuvable.`,
                },
            });
        }

        return updatedAccount;
    }

    async getAuth0AccessToken(): Promise<string> {
        const auth0Domain = this.configService.get<string>('AUTH0_DOMAIN')?.replace(/\/$/, '') || '';
        const response = await axios.post(`${auth0Domain}/oauth/token`, {
            client_id: this.configService.get<string>('AUTH0_M2M_CLIENT_ID'),
            client_secret: this.configService.get<string>('AUTH0_M2M_CLIENT_SECRET'),
            audience: `${auth0Domain}/api/v2/`,
            grant_type: 'client_credentials',
        });
        return response.data.access_token;
    }

    async getUserIdAndMoney(): Promise<{ userId: string; money: number }[]> {
        return this.accountModel.find({}, { userId: 1, money: 1, _id: 0 }).exec();
    }

    async deleteAllAuth0Accounts(): Promise<{ message: string }> {
        this.logger.log('Deleting all accounts from Auth0');
    
        const accessToken = await this.getAuth0AccessToken();
    
        try {
            const auth0Domain = this.configService.get<string>('AUTH0_DOMAIN')?.replace(/\/$/, '') || '';
            const usersResponse = await axios.get(`${auth0Domain}/api/v2/users`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
    
            const users = usersResponse.data;
    
            if (!users.length) {
                throw new NotFoundException({
                    error: {
                        en: 'No users found in Auth0 to delete.',
                        fr: 'Aucun utilisateur trouvé sur Auth0 à supprimer.',
                    },
                });
            }
    
            // Delete users one by one
            await Promise.all(
                users.map(async (user: { user_id: string }) => {
                    try {
                        await axios.delete(`${auth0Domain}/api/v2/users/${encodeURIComponent(user.user_id)}`, {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                            },
                        });
                        this.logger.log(`Successfully deleted Auth0 user: ${user.user_id}`);
                    } catch (error) {
                        this.logger.error(
                            `Failed to delete Auth0 user ${user.user_id}: ${error.message}`,
                        );
                    }
                }),
            );
    
            return { message: 'All Auth0 accounts have been deleted successfully.' };
        } catch (error) {
            this.logger.error(`Failed to fetch or delete users in Auth0: ${error.message}`);
            throw new InternalServerErrorException({
                error: {
                    en: 'An error occurred while deleting Auth0 accounts.',
                    fr: 'Une erreur s’est produite lors de la suppression des comptes Auth0.',
                },
            });
        }
    }
    private buildQueryOptions<T>(fields: T, session?: ClientSession): { new: true; fields: T; session?: ClientSession } {
        return session ? { new: true, fields, session } : { new: true, fields };
    }
}
