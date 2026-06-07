import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { HouseholdsModule } from "../households/households.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { UsersModule } from "../users/users.module";
import { CleaningController } from "./cleaning.controller";
import { CleaningService } from "./cleaning.service";

@Module({
  imports: [
    AuthModule,
    HouseholdsModule,
    NotificationsModule,
    PermissionsModule,
    UsersModule,
  ],
  controllers: [CleaningController],
  providers: [CleaningService],
  exports: [CleaningService],
})
export class CleaningModule {}
