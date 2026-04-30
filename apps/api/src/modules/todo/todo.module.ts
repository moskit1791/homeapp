import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { HouseholdsModule } from "../households/households.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { UsersModule } from "../users/users.module";
import { TodoController } from "./todo.controller";
import { TodoService } from "./todo.service";

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    HouseholdsModule,
    PermissionsModule,
    UsersModule,
  ],
  controllers: [TodoController],
  providers: [TodoService],
  exports: [TodoService],
})
export class TodoModule {}
