import { Friend, FriendDocument } from '@app/model/database/friend';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';

/**
 * Persistence adapter for canonical friend records.
 * Keeps query details out of application-service orchestration logic.
 */
@Injectable()
export class FriendRepository {
    constructor(@InjectModel(Friend.name) private readonly friendModel: Model<FriendDocument>) {}

    // Finds a pending request regardless of which user is sender/receiver.
    async findPendingRequestBetweenUsers(firstUserId: string, secondUserId: string, session?: ClientSession): Promise<FriendDocument | null> {
        return this.friendModel
            .findOne({
                $or: [
                    { senderId: firstUserId, receiverId: secondUserId, status: 'pending' },
                    { senderId: secondUserId, receiverId: firstUserId, status: 'pending' },
                ],
            })
            .session(session ?? null)
            .exec();
    }

    // Finds an accepted friendship regardless of direction.
    async findAcceptedFriendshipBetweenUsers(firstUserId: string, secondUserId: string, session?: ClientSession): Promise<FriendDocument | null> {
        return this.friendModel
            .findOne({
                $or: [
                    { senderId: firstUserId, receiverId: secondUserId, status: 'accepted' },
                    { senderId: secondUserId, receiverId: firstUserId, status: 'accepted' },
                ],
            })
            .session(session ?? null)
            .exec();
    }

    // Retrieves a request using the external requestId exposed to clients.
    async findByRequestId(requestId: string, session?: ClientSession): Promise<FriendDocument | null> {
        return this.friendModel
            .findOne({ requestId })
            .session(session ?? null)
            .exec();
    }

    // Creates the canonical pending edge with a normalized pair key.
    async createPendingRequest(senderId: string, receiverId: string, session?: ClientSession): Promise<FriendDocument> {
        const [createdRequest] = await this.friendModel.create(
            [
                {
                    senderId,
                    receiverId,
                    status: 'pending',
                    pairKey: this.buildPairKey(senderId, receiverId),
                },
            ],
            session ? { session } : undefined,
        );
        return createdRequest;
    }

    // Persists in-memory document changes.
    async save(request: FriendDocument, session?: ClientSession): Promise<FriendDocument> {
        return request.save(session ? { session } : undefined);
    }

    // Deletes a canonical friend record.
    async delete(request: FriendDocument, session?: ClientSession): Promise<void> {
        await request.deleteOne(session ? { session } : undefined);
    }

    // Produces a deterministic key used for uniqueness on unordered user pairs.
    buildPairKey(userIdA: string, userIdB: string): string {
        return [userIdA, userIdB].sort().join('#');
    }
}
