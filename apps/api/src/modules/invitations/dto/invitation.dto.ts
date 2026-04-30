import { IsString, Length } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @Length(1, 200)
  token!: string;
}
