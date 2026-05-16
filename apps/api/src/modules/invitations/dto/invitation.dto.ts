import { IsBoolean, IsString, Length, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @Length(1, 200)
  token!: string;
}

export class PreviewInvitationDto {
  @IsString()
  @Length(1, 200)
  token!: string;
}

export class CompleteInvitationRegistrationDto {
  @IsString()
  @Length(1, 200)
  token!: string;

  @IsString()
  @Length(1, 120)
  displayName!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsBoolean()
  acceptedTerms!: boolean;

  @IsBoolean()
  acceptedPrivacy!: boolean;
}
