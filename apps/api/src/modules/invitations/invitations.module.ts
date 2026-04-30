import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [AuthModule, DatabaseModule, UsersModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService]
})
export class InvitationsModule {}
