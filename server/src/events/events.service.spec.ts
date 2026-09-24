import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { EventsRepository } from './events.repo';
import { StorageService } from '../storage/storage.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventStatus } from '@prisma/client';

const mockEventsRepo: any = {
  findOrganizerByUserId: jest.fn(),
  createEvent: jest.fn(),
  findEvents: jest.fn(),
  countEvents: jest.fn(),
  findEventById: jest.fn(),
  findEventByIdWithOrganizer: jest.fn(),
  findEventByIdWithOrganizerFull: jest.fn(),
  findEventByIdWithRegistrations: jest.fn(),
  updateEvent: jest.fn(),
  updateEventStatus: jest.fn(),
  updatePosterUrl: jest.fn(),
};

const mockStorageService = {
  uploadPoster: jest.fn().mockResolvedValue({ url: 'https://azure.blob/event-posters/events/1/test.png', key: 'events/1/test.png' }),
  deleteByUrl: jest.fn().mockResolvedValue(undefined),
};

describe('EventsService - Updated Schema Int ID', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [EventsService, { provide: EventsRepository, useValue: mockEventsRepo }, { provide: StorageService, useValue: mockStorageService }],
    }).compile();
    service = mod.get(EventsService);
  });

  describe('create', () => {
    it('should reject if organizer not APPROVED', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'PENDING' });
      await expect(service.create({ eventName: 'E', date: new Date(Date.now() + 7200000).toISOString(), closingTime: new Date(Date.now() + 3600000).toISOString(), slots: 10 } as any, 'user1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should validate closingTime before date', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      await expect(service.create({ eventName: 'E', date: '2026-10-01T00:00:00Z', closingTime: '2026-10-02T00:00:00Z', slots: 10 } as any, 'user1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should create DRAFT event with new fields and int id', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockEventsRepo.createEvent.mockResolvedValue({ id: 1, status: EventStatus.DRAFT, eventName: 'E' });
      const res = await service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10 } as any, 'user1');
      expect(res.status).toBe(EventStatus.DRAFT);
      expect(res.id).toBe(1);
    });

    it('should reject slots <1', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      await expect(service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 0 } as any, 'user1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should default paymentRequired to false when not provided', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockEventsRepo.createEvent.mockResolvedValue({ id: 2, status: EventStatus.DRAFT, eventName: 'E', paymentRequired: false });
      await service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10 } as any, 'user1');
      expect(mockEventsRepo.createEvent).toHaveBeenCalledWith(expect.objectContaining({ paymentRequired: undefined }));
    });

    it('should create with paymentRequired true when provided', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockEventsRepo.createEvent.mockResolvedValue({ id: 3, status: EventStatus.DRAFT, eventName: 'E', paymentRequired: true });
      const res = await service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10, paymentRequired: true } as any, 'user1');
      expect(res.paymentRequired).toBe(true);
      expect(mockEventsRepo.createEvent).toHaveBeenCalledWith(expect.objectContaining({ paymentRequired: true }));
    });

    it('should create with paymentRequired false explicitly', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockEventsRepo.createEvent.mockResolvedValue({ id: 4, status: EventStatus.DRAFT, eventName: 'E', paymentRequired: false });
      const res = await service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10, paymentRequired: false } as any, 'user1');
      expect(res.paymentRequired).toBe(false);
      expect(mockEventsRepo.createEvent).toHaveBeenCalledWith(expect.objectContaining({ paymentRequired: false }));
    });
  });

  describe('status transitions', () => {
    it('should allow DRAFT -> PREVIEW', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: 1, status: EventStatus.DRAFT, organizerId: 'org1' });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      mockEventsRepo.updateEventStatus.mockResolvedValue({ id: 1, status: EventStatus.PREVIEW });
      const res = await service.preview(1, 'user1');
      expect(res.status).toBe(EventStatus.PREVIEW);
    });

    it('should reject invalid transition PUBLISHED -> PREVIEW', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: 1, status: EventStatus.PUBLISHED, organizerId: 'org1' });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      await expect(service.preview(1, 'user1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow PREVIEW -> PUBLISHED', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: 1, status: EventStatus.PREVIEW, organizerId: 'org1' });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockEventsRepo.updateEventStatus.mockResolvedValue({ id: 1, status: EventStatus.PUBLISHED });
      const res = await service.publish(1, 'user1');
      expect(res.status).toBe(EventStatus.PUBLISHED);
    });

    it('should enforce ownership on update', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: 1, organizerId: 'org1', status: EventStatus.DRAFT });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org2' });
      await expect(service.update(1, { eventName: 'New' } as any, 'user2')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should reject update on PUBLISHED event', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: 1, organizerId: 'org1', status: EventStatus.PUBLISHED, date: new Date(), closingTime: new Date(Date.now() - 1000000) });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      await expect(service.update(1, { eventName: 'New' } as any, 'user1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow updating paymentRequired on DRAFT event', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: 1, organizerId: 'org1', status: EventStatus.DRAFT, date: new Date('2026-10-02T10:00:00Z'), closingTime: new Date('2026-10-01T10:00:00Z') });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      mockEventsRepo.updateEvent.mockResolvedValue({ id: 1, paymentRequired: true });
      const res = await service.update(1, { paymentRequired: true } as any, 'user1');
      expect(res.paymentRequired).toBe(true);
      expect(mockEventsRepo.updateEvent).toHaveBeenCalledWith(1, expect.objectContaining({ paymentRequired: true }));
    });

    it('should allow updating paymentRequired to false', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: 1, organizerId: 'org1', status: EventStatus.DRAFT, date: new Date('2026-10-02T10:00:00Z'), closingTime: new Date('2026-10-01T10:00:00Z') });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      mockEventsRepo.updateEvent.mockResolvedValue({ id: 1, paymentRequired: false });
      const res = await service.update(1, { paymentRequired: false } as any, 'user1');
      expect(res.paymentRequired).toBe(false);
      expect(mockEventsRepo.updateEvent).toHaveBeenCalledWith(1, expect.objectContaining({ paymentRequired: false }));
    });
  });

  describe('public visibility', () => {
    it('findOnePublic should hide DRAFT', async () => {
      mockEventsRepo.findEventByIdWithOrganizer.mockResolvedValue({ id: 1, status: EventStatus.DRAFT });
      await expect(service.findOnePublic(1)).rejects.toBeInstanceOf(NotFoundException);
    });
    it('findOnePublic should allow PUBLISHED', async () => {
      mockEventsRepo.findEventByIdWithOrganizer.mockResolvedValue({ id: 1, status: EventStatus.PUBLISHED, eventName: 'Published' });
      const res = await service.findOnePublic(1);
      expect(res.eventName).toBe('Published');
    });
  });

  describe('validation', () => {
    it('should throw 400 for invalid ID type (handled by ParseIntPipe)', async () => {
      mockEventsRepo.findEventByIdWithOrganizer.mockResolvedValue(null);
      await expect(service.findOnePublic(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('uploadPoster', () => {
    const fakeFile = (overrides: Partial<Express.Multer.File> = {}) =>
      ({
        originalname: 'poster.png',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('fake'),
        ...overrides,
      } as unknown as Express.Multer.File);

    it('should upload poster for owner', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: 1, organizerId: 'org1', posterUrl: null });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      mockEventsRepo.updatePosterUrl.mockResolvedValue({ id: 1, posterUrl: 'https://azure.blob/event-posters/events/1/test.png' });
      const res = await service.uploadPoster(1, fakeFile(), 'user1');
      expect(res.posterUrl).toContain('https://');
      expect(mockStorageService.uploadPoster).toHaveBeenCalled();
    });

    it('should reject non-owner', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: 1, organizerId: 'org1' });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org2' });
      await expect(service.uploadPoster(1, fakeFile(), 'user2')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should reject invalid mimetype', async () => {
      await expect(service.uploadPoster(1, fakeFile({ mimetype: 'application/pdf' }), 'user1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject file over 5 MB', async () => {
      await expect(service.uploadPoster(1, fakeFile({ size: 6 * 1024 * 1024 }), 'user1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should delete old poster after replacement', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: 1, organizerId: 'org1', posterUrl: 'https://azure.blob/event-posters/events/1/old.png' });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      mockEventsRepo.updatePosterUrl.mockResolvedValue({ id: 1, posterUrl: 'https://azure.blob/event-posters/events/1/new.png' });
      await service.uploadPoster(1, fakeFile(), 'user1');
      expect(mockStorageService.deleteByUrl).toHaveBeenCalledWith('https://azure.blob/event-posters/events/1/old.png');
    });
  });
});
