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
import { AnnualCostsService } from './annual-costs.service';
import {
  AnnualCostHistoryQueryDto,
  AnnualCostIdParamDto,
  CompleteAnnualCostDto,
  CreateAnnualCostDto,
  UpdateAnnualCostDto
} from './dto/annual-costs.dto';

@Controller('annual-costs')
@UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
export class AnnualCostsController {
  constructor(private readonly annualCostsService: AnnualCostsService) {}

  @Get()
  @RequirePermission('annual_costs', 'read')
  listCosts(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.annualCostsService.listCosts(this.requireHousehold(household).householdId);
  }

  @Post()
  @RequirePermission('annual_costs', 'create')
  createCost(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateAnnualCostDto
  ) {
    return this.annualCostsService.createCost(this.requireHousehold(household).householdId, dto);
  }

  @Patch(':id')
  @RequirePermission('annual_costs', 'update')
  async updateCost(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: AnnualCostIdParamDto,
    @Body() dto: UpdateAnnualCostDto
  ) {
    const cost = await this.annualCostsService.updateCost(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!cost) {
      throw new NotFoundException('Annual cost not found');
    }

    return cost;
  }

  @Delete(':id')
  @RequirePermission('annual_costs', 'delete')
  async deleteCost(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: AnnualCostIdParamDto
  ) {
    const deleted = await this.annualCostsService.deleteCost(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Annual cost not found');
    }

    return { ok: true };
  }

  @Post(':id/complete')
  @RequirePermission('annual_costs', 'update')
  async completeCost(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: AnnualCostIdParamDto,
    @Body() dto: CompleteAnnualCostDto
  ) {
    const completion = await this.annualCostsService.completeCost(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!completion) {
      throw new NotFoundException('Annual cost not found');
    }

    return completion;
  }

  @Get('history')
  @RequirePermission('annual_costs', 'read')
  listHistory(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Query() query: AnnualCostHistoryQueryDto
  ) {
    return this.annualCostsService.listHistory(
      this.requireHousehold(household).householdId,
      query.year
    );
  }

  private requireHousehold(household: HouseholdContext | undefined): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException('Missing household context');
    }

    return household;
  }
}
