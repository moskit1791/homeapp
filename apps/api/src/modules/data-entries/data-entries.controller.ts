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
import {
  CreateDataEntryDto,
  DataEntryIdParamDto,
  DataEntrySearchDto,
  UpdateDataEntryDto
} from './dto/data-entry.dto';
import { DataEntriesService } from './data-entries.service';

@Controller('data-entries')
@UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
export class DataEntriesController {
  constructor(private readonly dataEntriesService: DataEntriesService) {}

  @Get()
  @RequirePermission('data_entries', 'read')
  listEntries(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Query() query: DataEntrySearchDto
  ) {
    return this.dataEntriesService.listEntries(
      this.requireHousehold(household).householdId,
      query.search
    );
  }

  @Post()
  @RequirePermission('data_entries', 'create')
  createEntry(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateDataEntryDto
  ) {
    return this.dataEntriesService.createEntry(this.requireHousehold(household).householdId, dto);
  }

  @Patch(':id')
  @RequirePermission('data_entries', 'update')
  async updateEntry(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: DataEntryIdParamDto,
    @Body() dto: UpdateDataEntryDto
  ) {
    const entry = await this.dataEntriesService.updateEntry(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!entry) {
      throw new NotFoundException('Data entry not found');
    }

    return entry;
  }

  @Delete(':id')
  @RequirePermission('data_entries', 'delete')
  async deleteEntry(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: DataEntryIdParamDto
  ) {
    const deleted = await this.dataEntriesService.deleteEntry(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Data entry not found');
    }

    return { ok: true };
  }

  private requireHousehold(household: HouseholdContext | undefined): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException('Missing household context');
    }

    return household;
  }
}
