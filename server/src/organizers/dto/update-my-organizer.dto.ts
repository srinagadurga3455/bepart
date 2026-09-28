import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PHONE_MESSAGE, PHONE_REGEX, UPI_ID_MESSAGE, UPI_ID_REGEX } from '../../common/constants/validation';

// Organizer self-service profile update (PATCH /organizers/me).
// Status/email-identity changes are intentionally excluded: email edits go
// through the same endpoint but sync the login User with uniqueness checks
// (see service). Admin-only fields (status) are not accepted here.
export class UpdateMyOrganizerDto {
  @ApiPropertyOptional({ example: 'Tech Club' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'Official tech club of campus' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '+91 9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone?: string;

  @ApiPropertyOptional({ example: 'organizer@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'techclub@upi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(UPI_ID_REGEX, { message: UPI_ID_MESSAGE })
  upiId?: string;
}
