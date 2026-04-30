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
import { AttachmentsService } from './attachments.service';
import {
  AttachmentIdParamDto,
  CreateAttachmentDto,
  CreateAttachmentUploadUrlDto,
  ListAttachmentsDto,
  UpdateAttachmentDto
} from './dto/attachments.dto';

@Controller('attachments')
@UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  @RequirePermission('attachments', 'read')
  listAttachments(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Query() query: ListAttachmentsDto
  ) {
    return this.attachmentsService.listAttachments(
      this.requireHousehold(household).householdId,
      query.search
    );
  }

  @Post('upload-url')
  @RequirePermission('attachments', 'create')
  createUploadUrl(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateAttachmentUploadUrlDto
  ) {
    return this.attachmentsService.createUploadContract(
      this.requireHousehold(household).householdId,
      dto
    );
  }

  @Post()
  @RequirePermission('attachments', 'create')
  createAttachment(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateAttachmentDto
  ) {
    const householdContext = this.requireHousehold(household);

    return this.attachmentsService.createAttachment(
      householdContext.householdId,
      householdContext.memberId,
      dto
    );
  }

  @Patch(':id')
  @RequirePermission('attachments', 'update')
  async updateAttachment(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: AttachmentIdParamDto,
    @Body() dto: UpdateAttachmentDto
  ) {
    const attachment = await this.attachmentsService.updateAttachment(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    return attachment;
  }

  @Delete(':id')
  @RequirePermission('attachments', 'delete')
  async deleteAttachment(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: AttachmentIdParamDto
  ) {
    const deleted = await this.attachmentsService.deleteAttachment(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Attachment not found');
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
