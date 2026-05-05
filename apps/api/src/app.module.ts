import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnnualCostsModule } from './modules/annual-costs/annual-costs.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { AuthModule } from './modules/auth/auth.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { CleaningModule } from './modules/cleaning/cleaning.module';
import { DataEntriesModule } from './modules/data-entries/data-entries.module';
import { DatabaseModule } from './modules/database/database.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthController } from './modules/health/health.controller';
import { HouseholdsModule } from './modules/households/households.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MealPlannerModule } from './modules/meal-planner/meal-planner.module';
import { NotesModule } from './modules/notes/notes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ShoppingModule } from './modules/shopping/shopping.module';
import { StartModule } from './modules/start/start.module';
import { TodoModule } from './modules/todo/todo.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    HouseholdsModule,
    InvitationsModule,
    PermissionsModule,
    FinanceModule,
    MealPlannerModule,
    CalendarModule,
    TodoModule,
    NotesModule,
    NotificationsModule,
    ShoppingModule,
    CleaningModule,
    AnnualCostsModule,
    DataEntriesModule,
    AttachmentsModule,
    StartModule,
    RealtimeModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
