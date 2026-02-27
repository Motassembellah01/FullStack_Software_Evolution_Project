import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FriendDocument = Friend & Document;

/**
 * Canonical friend-edge record.
 * This schema tracks the lifecycle of request/relationship states and is the
 * authoritative write model for friend-domain mutations.
 */
@Schema({ collection: 'friend', timestamps: true })
export class Friend {
    // Public identifier used by API calls so client never depends on Mongo ObjectId.
    @Prop({ required: true, default: () => new Types.ObjectId().toString(), unique: true })
    requestId: string;

    // User who initiated the request.
    @Prop({ required: true, ref: 'account' })
    senderId: string;

    // User who received the request.
    @Prop({ required: true, ref: 'account' })
    receiverId: string;

    // Request lifecycle status.
    @Prop({ required: true, enum: ['pending', 'accepted', 'rejected'], default: 'pending' })
    status: 'pending' | 'accepted' | 'rejected';

    // Unordered pair key: same value for (A,B) and (B,A).
    @Prop({ required: true })
    pairKey: string;

    // Stored explicitly for compatibility with existing payload expectations.
    @Prop({ required: true, default: Date.now })
    createdAt: Date;

    // Automatically maintained by Mongoose timestamps option.
    updatedAt: Date;
}

export const friendSchema = SchemaFactory.createForClass(Friend);

// Fast lookup by external request identifier.
friendSchema.index({ requestId: 1 }, { unique: true });
// Guarantees one active edge per pair for pending/accepted states.
friendSchema.index({ pairKey: 1, status: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['pending', 'accepted'] } } });
// Supports directional status queries used in repository filters.
friendSchema.index({ senderId: 1, receiverId: 1, status: 1 });
