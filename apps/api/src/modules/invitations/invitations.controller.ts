import { Body, Controller, Get, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UserContext } from '../../shared/request-context';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AcceptInvitationDto,
  CompleteInvitationRegistrationDto,
  PreviewInvitationDto
} from './dto/invitation.dto';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get('preview')
  previewInvitation(@Query() dto: PreviewInvitationDto) {
    return this.invitationsService.previewInvitation(dto);
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  acceptInvitation(
    @CurrentUser() user: UserContext | undefined,
    @Body() dto: AcceptInvitationDto
  ) {
    if (!user) {
      throw new UnauthorizedException('Missing user context');
    }

    return this.invitationsService.acceptInvitation(user, dto);
  }

  @Post('complete-registration')
  completeRegistration(@Body() dto: CompleteInvitationRegistrationDto) {
    return this.invitationsService.completeRegistration(dto);
  }
}
