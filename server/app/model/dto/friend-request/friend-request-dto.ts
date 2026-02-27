import { Account } from '@app/model/database/account';

/**
 * Denormalized request payload embedded in account projections.
 * It intentionally stores lightweight sender info for direct UI rendering
 * without additional account lookups.
 */
export class FriendRequestDto {
    // Public request identifier matching canonical friend.requestId.
    requestId: string;
    // Minimal sender data required by the client request list.
    senderBasicInfo: Partial<Account>;
}