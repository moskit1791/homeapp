import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { CurrentHousehold } from "../../shared/decorators/current-household.decorator";
import { HouseholdContext } from "../../shared/request-context";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { HouseholdContextGuard } from "../households/guards/household-context.guard";
import {
  EncryptionModuleParamDto,
  RemoveHouseholdEncryptionDto,
  UpdateHouseholdEncryptionDto,
} from "./dto/encryption.dto";
import { EncryptionService } from "./encryption.service";

@Controller("encryption")
@UseGuards(JwtAuthGuard, HouseholdContextGuard)
export class EncryptionController {
  constructor(private readonly encryptionService: EncryptionService) {}

  @Get("household")
  async getHouseholdSettings(
    @CurrentHousehold() household: HouseholdContext | undefined,
  ) {
    const context = this.requireHousehold(household);

    return {
      ...(await this.encryptionService.getSettings(context.householdId)),
      canManage: context.role === "owner",
    };
  }

  @Put("household")
  async updateHouseholdSettings(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: UpdateHouseholdEncryptionDto,
  ) {
    const context = this.requireHousehold(household);

    if (context.role !== "owner") {
      throw new ForbiddenException(
        "Only the household owner can manage encryption",
      );
    }

    return {
      ...(await this.encryptionService.updateSettings(
        context.householdId,
        context.memberId,
        dto,
      )),
      canManage: true,
    };
  }

  @Post("household/remove")
  async removeHouseholdSettings(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: RemoveHouseholdEncryptionDto,
  ) {
    const context = this.requireHousehold(household);

    if (context.role !== "owner") {
      throw new ForbiddenException(
        "Only the household owner can remove encryption",
      );
    }

    return {
      ...(await this.encryptionService.removeSettings(
        context.householdId,
        dto,
      )),
      canManage: true,
    };
  }

  @Get("household/export/:module")
  async exportHouseholdData(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: EncryptionModuleParamDto,
  ) {
    const context = this.requireHousehold(household);

    if (context.role !== "owner") {
      throw new ForbiddenException(
        "Only the household owner can migrate encryption",
      );
    }

    return this.encryptionService.exportModule(
      context.householdId,
      params.module,
    );
  }

  private requireHousehold(
    household: HouseholdContext | undefined,
  ): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException("Missing household context");
    }

    return household;
  }
}
