import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles';
import { RequestUser } from '../common/types/jwt-payload';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create event → DRAFT', description: 'Only APPROVED organizers, uses logged-in organizer' })
  @ApiBody({ type: CreateEventDto })
  @ApiResponse({ status: 201, description: 'Event created DRAFT with integer id' })
  @ApiResponse({ status: 400, description: 'Invalid date/slots' })
  @ApiResponse({ status: 403, description: 'Not approved organizer' })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: RequestUser) {
    return this.eventsService.create(dto, user.userId || user.id);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'List published events (public)', description: 'Paginated PUBLISHED only, no auth' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Paginated events {data, meta} with integer ids' })
  findPublished(@Query() query: QueryEventDto) {
    return this.eventsService.findPublished(query);
  }

  @Get('my')
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List my events (ORGANIZER)', description: 'Own events with status filter' })
  @ApiResponse({ status: 200, description: 'Paginated own events' })
  @ApiResponse({ status: 403, description: 'Organizer only' })
  findMy(@Query() query: QueryEventDto, @CurrentUser() user: RequestUser) {
    return this.eventsService.findMyEvents(user.userId || user.id, query);
  }

  @Public()
  @Get('public/:id')
  @ApiOperation({ summary: 'Public event detail (PUBLISHED only)', description: 'No auth, only PUBLISHED' })
  @ApiParam({ name: 'id', type: Number, description: 'Event integer ID' })
  @ApiResponse({ status: 200, description: 'Event with organizer.name' })
  @ApiResponse({ status: 400, description: 'Invalid ID (must be integer)' })
  @ApiResponse({ status: 404, description: 'Not found / unpublished' })
  findOnePublic(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.findOnePublic(id);
  }

  @Get(':id')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get event detail (owner or ADMIN)' })
  @ApiParam({ name: 'id', type: Number, description: 'Event integer ID' })
  @ApiResponse({ status: 200, description: 'Event detail' })
  @ApiResponse({ status: 400, description: 'Invalid ID' })
  @ApiResponse({ status: 403, description: 'Not owner' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    if (user.role === Role.ADMIN) return this.eventsService.findOneForAdmin(id);
    return this.eventsService.findOneForOrganizer(id, user.userId || user.id);
  }

  @Patch(':id')
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update own event (DRAFT/PREVIEW only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Event integer ID' })
  @ApiBody({ type: UpdateEventDto })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Invalid ID / date' })
  @ApiResponse({ status: 403, description: 'Not owner or cannot update PUBLISHED' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEventDto, @CurrentUser() user: RequestUser) {
    return this.eventsService.update(id, dto, user.userId || user.id);
  }

  @Post(':id/preview')
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Move DRAFT → PREVIEW (owner only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Event integer ID' })
  @ApiResponse({ status: 201, description: 'PREVIEW' })
  @ApiResponse({ status: 400, description: 'Invalid ID' })
  @ApiResponse({ status: 403, description: 'Not owner / invalid transition' })
  @ApiResponse({ status: 404, description: 'Not found' })
  preview(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.eventsService.preview(id, user.userId || user.id);
  }

  @Post(':id/publish')
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Publish PREVIEW → PUBLISHED (owner only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Event integer ID' })
  @ApiResponse({ status: 201, description: 'PUBLISHED' })
  @ApiResponse({ status: 400, description: 'Invalid ID / transition' })
  @ApiResponse({ status: 403, description: 'Not owner' })
  @ApiResponse({ status: 404, description: 'Not found' })
  publish(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.eventsService.publish(id, user.userId || user.id);
  }

  @Post(':id/cancel')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cancel event (valid transition, owner only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Event integer ID' })
  @ApiResponse({ status: 201, description: 'CANCELLED' })
  @ApiResponse({ status: 400, description: 'Invalid ID / transition' })
  @ApiResponse({ status: 403, description: 'Not owner' })
  @ApiResponse({ status: 404, description: 'Not found' })
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.eventsService.cancel(id, user.userId || user.id, user.role);
  }

  @Post(':id/poster')
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new BadRequestException(`Invalid file type ${file.mimetype}. Allowed: jpeg, png, webp`), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload event poster', description: 'ORGANIZER only — upload poster for own event. Returns posterUrl.' })
  @ApiParam({ name: 'id', type: Number, description: 'Event integer ID' })
  @ApiBody({
    description: 'Poster image (jpeg/png/webp, max 5 MB)',
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Poster uploaded {message, posterUrl}' })
  @ApiResponse({ status: 400, description: 'Invalid file type / too large / missing' })
  @ApiResponse({ status: 403, description: 'Not owner' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  uploadPoster(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: RequestUser) {
    return this.eventsService.uploadPoster(id, file, user.userId || user.id);
  }
}
