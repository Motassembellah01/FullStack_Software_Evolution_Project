import { Injectable } from '@angular/core';

/**
 * Pure relationship policy helpers.
 * Keeping these checks centralized avoids duplicated friend/block logic across components.
 */
@Injectable({
    providedIn: 'root',
})
export class RelationshipPolicyService {
    // True if the current user has blocked the target user.
    isBlockedByCurrentUser(userId: string, blockedUsers: string[]): boolean {
        return blockedUsers.includes(userId);
    }

    // True if the target user blocks the current user.
    isBlockingCurrentUser(userId: string, usersBlockingMe: string[]): boolean {
        return usersBlockingMe.includes(userId);
    }

    // Friend-only matches are visible only when organizer is in the current friend list.
    canAccessFriendOnlyMatch(managerId: string, isFriendMatch: boolean, friendIds: string[]): boolean {
        if (!isFriendMatch) {
            return true;
        }
        return friendIds.includes(managerId);
    }
}
