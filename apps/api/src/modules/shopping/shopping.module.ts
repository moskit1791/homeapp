import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { HouseholdsModule } from '../households/households.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { ShoppingController } from './shopping.controller';
import { ShoppingService } from './shopping.service';

@Module({
  imports: [AuthModule, DatabaseModule, HouseholdsModule, PermissionsModule, UsersModule],
  controllers: [ShoppingController],
  providers: [ShoppingService],
  exports: [ShoppingService]
})
export class ShoppingModule {}
