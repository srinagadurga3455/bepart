import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class UpdateRegistrationDto {
  @ApiPropertyOptional({ description: 'Custom data update (only owner or admin before confirmation)' })
  @IsOptional()
  customData?: any;
}
