import { FriendApplicationService } from '@app/services/friend/friend-application.service';
import { Controller, Delete, Param, Post } from '@nestjs/common';

/**
 * HTTP adapter for friend-domain commands.
 * This controller intentionally stays thin: it only parses route params
 * and delegates all business rules to FriendApplicationService.
 */
@Controller('friends')
export class FriendController {
    constructor(private readonly friendApplicationService: FriendApplicationService) {}

    // Creates a pending friend request between sender and receiver.
    @Post('send/:senderId/:receiverId')
    async sendFriendRequest(@Param('senderId') senderId: string, @Param('receiverId') receiverId: string): Promise<void> {
        await this.friendApplicationService.sendFriendRequest(senderId, receiverId);
    }

    // Accepts a pending friend request and creates the mutual friend relation.
    @Post('accept/:requestId')
    async acceptFriendRequest(@Param('requestId') requestId: string): Promise<void> {
        await this.friendApplicationService.acceptFriendRequest(requestId);
    }

    // Rejects a pending request and removes it from both projection lists.
    @Post('reject/:requestId')
    async rejectFriendRequest(@Param('requestId') requestId: string): Promise<void> {
        await this.friendApplicationService.rejectFriendRequest(requestId);
    }

    // Removes an existing accepted friendship relation.
    @Delete('remove/:userId/:friendId')
    async removeFriend(@Param('userId') userId: string, @Param('friendId') friendId: string): Promise<void> {
        await this.friendApplicationService.removeFriend(userId, friendId);
    }

    // Blocks a non-friend user.
    @Post('block/:userId/:blockedUserId')
    async blockNormalUser(@Param('userId') userId: string, @Param('blockedUserId') blockedUserId: string): Promise<void> {
        await this.friendApplicationService.blockNormalUser(userId, blockedUserId);
    }

    // Blocks a current friend and removes the friendship if present.
    @Post('blockFriend/:userId/:blockedFriendId')
    async blockFriend(@Param('userId') userId: string, @Param('blockedFriendId') blockedFriendId: string): Promise<void> {
        await this.friendApplicationService.blockFriend(userId, blockedFriendId);
    }

    // Blocks a user while also removing the pending request edge.
    @Post('blockUserWithPendingRequest/:userId/:otherUserId')
    async blockUserWithPendingRequest(@Param('userId') userId: string, @Param('otherUserId') otherUserId: string): Promise<void> {
        await this.friendApplicationService.blockUserWithPendingRequest(userId, otherUserId);
    }

    // Cancels a sent pending request.
    @Post('cancelRequest/:senderId/:receiverId')
    async cancelFriendRequest(@Param('senderId') senderId: string, @Param('receiverId') receiverId: string): Promise<void> {
        await this.friendApplicationService.cancelFriendRequest(senderId, receiverId);
    }

    // Removes a user from the caller's block list.
    @Post('unblock/:userId/:blockedUserId')
    async unblockUser(@Param('userId') userId: string, @Param('blockedUserId') blockedUserId: string): Promise<void> {
        await this.friendApplicationService.unblockUser(userId, blockedUserId);
    }
}
