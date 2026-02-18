import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Auth0SyncGuard } from './auth0-sync.guard';
import { AuthorizationGuard } from './authorization.guard';

@Module({
    imports: [ConfigModule],
    providers: [AuthorizationGuard, Auth0SyncGuard, Logger],
    exports: [AuthorizationGuard, Auth0SyncGuard],
})
export class AuthorizationModule {}
