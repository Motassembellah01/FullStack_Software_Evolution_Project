import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Protects the Auth0 sync endpoint: only requests with the correct secret header are allowed.
 * Auth0 Actions cannot use the user's JWT for this call, so we use a shared secret instead.
 */
@Injectable()
export class Auth0SyncGuard implements CanActivate {
    constructor(private configService: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const secret = this.configService.get<string>('AUTH0_SYNC_SECRET');
        if (!secret) {
            throw new UnauthorizedException('AUTH0_SYNC_SECRET is not configured');
        }
        const headerSecret = request.headers['x-auth0-sync-secret'] as string | undefined;
        if (headerSecret !== secret) {
            throw new UnauthorizedException('Invalid sync secret');
        }
        return true;
    }
}
