import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { CurrentHousehold } from '../../shared/decorators/current-household.decorator';
import { HouseholdContext } from '../../shared/request-context';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdContextGuard } from '../households/guards/household-context.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { CalendarService } from './calendar.service';
import {
  CalendarDateRangeDto,
  CalendarEventIdParamDto,
  CalendarUpcomingDto,
  CreateCalendarEventDto,
  UpdateCalendarEventDto
} from './dto/calendar.dto';

@Controller('calendar')
@UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  @RequirePermission('calendar', 'read')
  listEvents(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Query() query: CalendarDateRangeDto
  ) {
    return this.calendarService.listEvents(
      this.requireHousehold(household).householdId,
      query.from,
      query.to
    );
  }

  @Post('events')
  @RequirePermission('calendar', 'create')
  createEvent(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateCalendarEventDto
  ) {
    return this.calendarService.createEvent(this.requireHousehold(household).householdId, dto);
  }

  @Patch('events/:id')
  @RequirePermission('calendar', 'update')
  async updateEvent(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: CalendarEventIdParamDto,
    @Body() dto: UpdateCalendarEventDto
  ) {
    const event = await this.calendarService.updateEvent(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    return event;
  }

  @Delete('events/:id')
  @RequirePermission('calendar', 'delete')
  async deleteEvent(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: CalendarEventIdParamDto
  ) {
    const deleted = await this.calendarService.deleteEvent(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Calendar event not found');
    }

    return { ok: true };
  }

  @Get('upcoming')
  @RequirePermission('calendar', 'read')
  listUpcoming(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Query() query: CalendarUpcomingDto
  ) {
    return this.calendarService.listUpcoming(
      this.requireHousehold(household).householdId,
      query.limit ?? 5
    );
  }

  private requireHousehold(household: HouseholdContext | undefined): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException('Missing household context');
    }

    return household;
  }
}
