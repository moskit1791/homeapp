import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { HouseholdsModule } from "../households/households.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { UsersModule } from "../users/users.module";
import { NotesController } from "./notes.controller";
import { NotesService } from "./notes.service";

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    HouseholdsModule,
    PermissionsModule,
    UsersModule,
  ],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
