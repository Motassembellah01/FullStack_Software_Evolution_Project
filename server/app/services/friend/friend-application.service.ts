import { AccountService } from '@app/services/account/account.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';
import { FriendRepository } from './friend.repository';

/**
 * Application layer for all friend-domain commands.
 *
 * Responsibilities:
 * - enforce friend-domain invariants (no self-request, pending/accepted state checks, etc.)
 * - orchestrate repository writes and account projection updates
 * - guarantee consistency by wrapping multi-document operations in a Mongo transaction
 */
@Injectable()
export class FriendApplicationService {
    constructor(
        private readonly friendRepository: FriendRepository,
        private readonly accountService: AccountService,
        @InjectConnection() private readonly connection: Connection,
    ) {}

    /**
     * Creates a new pending request and updates account-side projections used by the UI.
     */
    async sendFriendRequest(senderId: string, receiverId: string): Promise<void> {
        if (senderId === receiverId) {
            throw new BadRequestException('Friend request to self is not allowed.');
        }

        await this.withTransaction(async (session) => {
            // Prevent duplicate pending requests in both directions.
            const existingPendingRequest = await this.friendRepository.findPendingRequestBetweenUsers(senderId, receiverId, session);
            if (existingPendingRequest) {
                throw new BadRequestException('Friend request already exists.');
            }

            const newRequest = await this.friendRepository.createPendingRequest(senderId, receiverId, session);
            const senderBasicInfo = await this.accountService.findBasicInfoByUserId(senderId);
            await this.accountService.addFriendRequest(receiverId, senderBasicInfo, newRequest.requestId, session);
        });
    }

    /**
     * Accepts a pending request:
     * 1) marks canonical friend record as accepted
     * 2) updates both account friend projections
     * 3) removes request-specific projections
     */
    async acceptFriendRequest(requestId: string): Promise<void> {
        await this.withTransaction(async (session) => {
            const request = await this.friendRepository.findByRequestId(requestId, session);
            if (!request) {
                throw new BadRequestException('Friend request not found.');
            }

            if (request.status !== 'pending') {
                throw new BadRequestException('This friend request has already been processed.');
            }

            request.status = 'accepted';
            await this.friendRepository.save(request, session);
            await this.accountService.addFriend(request, session);
        });
    }

    /**
     * Rejects a pending request and removes request projections.
     */
    async rejectFriendRequest(requestId: string): Promise<void> {
        await this.withTransaction(async (session) => {
            const request = await this.friendRepository.findByRequestId(requestId, session);
            if (!request) {
                throw new BadRequestException('Friend request not found.');
            }

            if (request.status !== 'pending') {
                throw new BadRequestException('This friend request has already been processed.');
            }

            await this.accountService.removeFriendRequestFromAccount(request, session);
            await this.friendRepository.delete(request, session);
        });
    }

    /**
     * Removes an accepted friendship relation and synchronizes both account projections.
     */
    async removeFriend(userId: string, friendId: string): Promise<void> {
        await this.withTransaction(async (session) => {
            const friendship = await this.friendRepository.findAcceptedFriendshipBetweenUsers(userId, friendId, session);
            if (!friendship) {
                throw new BadRequestException('Friendship not found.');
            }

            await this.accountService.removeFriendRequestFromAccount(friendship, session);
            await this.accountService.removeFriend(friendship, session);
            await this.friendRepository.delete(friendship, session);
        });
    }

    /**
     * Blocks a friend. The block edge is added first, then friendship is removed if it exists.
     */
    async blockFriend(userId: string, friendId: string): Promise<void> {
        await this.withTransaction(async (session) => {
            await this.accountService.addToBlockList(userId, friendId, session);
            const friendship = await this.friendRepository.findAcceptedFriendshipBetweenUsers(userId, friendId, session);
            if (friendship) {
                await this.accountService.removeFriendRequestFromAccount(friendship, session);
                await this.accountService.removeFriend(friendship, session);
                await this.friendRepository.delete(friendship, session);
            }
        });
    }

    /**
     * Blocks a non-friend user (no friend edge mutation required).
     */
    async blockNormalUser(userId: string, otherUserId: string): Promise<void> {
        await this.withTransaction(async (session) => {
            await this.accountService.addToBlockList(userId, otherUserId, session);
        });
    }

    /**
     * For a pending request edge: remove request first, then add block.
     */
    async blockUserWithPendingRequest(userId: string, otherUserId: string): Promise<void> {
        await this.withTransaction(async (session) => {
            const pendingRequest = await this.friendRepository.findPendingRequestBetweenUsers(userId, otherUserId, session);
            if (!pendingRequest) {
                throw new BadRequestException('No pending friend request found.');
            }

            await this.accountService.removeFriendRequestFromAccount(pendingRequest, session);
            await this.friendRepository.delete(pendingRequest, session);
            await this.accountService.addToBlockList(userId, otherUserId, session);
        });
    }

    /**
     * Cancels a sender-owned pending request.
     */
    async cancelFriendRequest(senderId: string, receiverId: string): Promise<void> {
        await this.withTransaction(async (session) => {
            const pendingRequest = await this.friendRepository.findPendingRequestBetweenUsers(senderId, receiverId, session);
            if (!pendingRequest || pendingRequest.senderId !== senderId || pendingRequest.receiverId !== receiverId) {
                throw new BadRequestException('No pending friend request found to cancel.');
            }

            await this.accountService.removeFriendRequestFromAccount(pendingRequest, session);
            await this.friendRepository.delete(pendingRequest, session);
        });
    }

    /**
     * Removes block edge from current user to blocked user.
     */
    async unblockUser(userId: string, blockedUserId: string): Promise<void> {
        await this.withTransaction(async (session) => {
            await this.accountService.removeFromBlockList(userId, blockedUserId, session);
        });
    }

    /**
     * Shared transaction wrapper so every command has the same consistency guarantees.
     */
    private async withTransaction(callback: (session: ClientSession) => Promise<void>): Promise<void> {
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                await callback(session);
            });
        } finally {
            await session.endSession();
        }
    }
}
