import {
  BadRequestException,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles';
import { RequestUser } from '../common/types/jwt-payload';

const allowedMimetypes = ['image/jpeg', 'image/png', 'image/webp'];
const fileInterceptorOptions = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    if (!allowedMimetypes.includes(file.mimetype) && file.mimetype !== 'image/jpg') {
      return cb(new BadRequestException(`Invalid file type ${file.mimetype}. Allowed: jpg, jpeg, png, webp`), false);
    }
    cb(null, true);
  },
};

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('events/:eventId/poster-square')
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload event square poster (R2)', description: 'Stores at R2 events/{eventId}/poster-square.<ext>, validates 1:1 aspect ratio, replaces previous. Only owner ORGANIZER.' })
  @ApiParam({ name: 'eventId', type: String, description: 'Event UUID' })
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @ApiResponse({ status: 201, description: 'Square poster uploaded {posterSquareUrl}' })
  @ApiResponse({ status: 400, description: 'Invalid aspect ratio / file type / too large' })
  @ApiResponse({ status: 403, description: 'Forbidden - organizer owner only, ADMIN denied' })
  async uploadEventPosterSquare(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    return this.storageService.handleEventPosterSquareUpload(file, eventId, user);
  }

  @Post('events/:eventId/poster-rectangle')
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload event rectangle poster (R2)', description: 'Stores at R2 events/{eventId}/poster-rectangle.<ext>, validates landscape 16:9, replaces previous. Only owner ORGANIZER.' })
  @ApiParam({ name: 'eventId', type: String, description: 'Event UUID' })
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @ApiResponse({ status: 201, description: 'Rectangle poster uploaded {posterRectangleUrl}' })
  @ApiResponse({ status: 400, description: 'Invalid aspect ratio / file type / too large' })
  @ApiResponse({ status: 403, description: 'Forbidden - organizer owner only, ADMIN denied' })
  async uploadEventPosterRectangle(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    return this.storageService.handleEventPosterRectangleUpload(file, eventId, user);
  }
}
