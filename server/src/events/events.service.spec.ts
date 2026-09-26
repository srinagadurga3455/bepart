import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { EventsRepository } from './events.repo';
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
};

const mockCouponsService: any = {
  create: jest.fn(),
};

const mockCouponsRepo: any = {
  findByEvent: jest.fn().mockResolvedValue([]),
  hasActiveCouponForEvent: jest.fn().mockResolvedValue(false),
};

describe('EventsService - Updated Schema Int ID', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCouponsRepo.findByEvent.mockResolvedValue([]);
    mockCouponsRepo.hasActiveCouponForEvent.mockResolvedValue(false);
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: EventsRepository, useValue: mockEventsRepo },
        { provide: require('../coupons/coupons.service').CouponsService, useValue: mockCouponsService },
        { provide: require('../coupons/coupons.repo').CouponsRepository, useValue: mockCouponsRepo },
      ],
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
      mockEventsRepo.createEvent.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: EventStatus.DRAFT, eventName: 'E' });
      const res = await service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10 } as any, 'user1');
      expect(res.status).toBe(EventStatus.DRAFT);
      expect(res.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should reject slots <1', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      await expect(service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 0 } as any, 'user1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should default paymentRequired to false when not provided', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockEventsRepo.createEvent.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440001', status: EventStatus.DRAFT, eventName: 'E', paymentRequired: false });
      await service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10 } as any, 'user1');
      expect(mockEventsRepo.createEvent).toHaveBeenCalledWith(expect.objectContaining({ paymentRequired: undefined }));
    });

    it('should create with paymentRequired true when provided', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockEventsRepo.createEvent.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440002', status: EventStatus.DRAFT, eventName: 'E', paymentRequired: true });
      const res = await service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10, paymentRequired: true } as any, 'user1');
      expect(res.paymentRequired).toBe(true);
      expect(mockEventsRepo.createEvent).toHaveBeenCalledWith(expect.objectContaining({ paymentRequired: true }));
    });

    it('should create with paymentRequired false explicitly', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockEventsRepo.createEvent.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440003', status: EventStatus.DRAFT, eventName: 'E', paymentRequired: false });
      const res = await service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10, paymentRequired: false } as any, 'user1');
      expect(res.paymentRequired).toBe(false);
      expect(mockEventsRepo.createEvent).toHaveBeenCalledWith(expect.objectContaining({ paymentRequired: false }));
    });

    it('should create event without coupon (NO) and no coupon row', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockEventsRepo.createEvent.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440010', status: EventStatus.DRAFT });
      const res: any = await service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10, coupon: { enabled: false } } as any, 'user1');
      expect(res.hasCoupon).toBe(false);
      expect(res.coupon).toBeNull();
      expect(mockCouponsService.create).not.toHaveBeenCalled();
    });

    it('should create event with auto-generated coupon (YES) linked to the event', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockEventsRepo.createEvent.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440011', status: EventStatus.DRAFT });
      mockCouponsService.create.mockResolvedValue({ id: 'c1', code: 'PV7K2M9XQ4T8D', eventId: '550e8400-e29b-41d4-a716-446655440011' });
      const res: any = await service.create({
        eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10,
        coupon: { enabled: true, discountType: 'PERCENTAGE', discountValue: 20 },
      } as any, 'user1', 'ORGANIZER');
      expect(mockCouponsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: '550e8400-e29b-41d4-a716-446655440011', discountType: 'PERCENTAGE', discountValue: 20 }),
        expect.objectContaining({ userId: 'user1' }),
      );
      expect(res.hasCoupon).toBe(true);
      expect(res.coupon.code).toBe('PV7K2M9XQ4T8D');
    });

    it('should reject coupon.enabled=true without discount config (no orphan event)', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      await expect(service.create({
        eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10,
        coupon: { enabled: true },
      } as any, 'user1')).rejects.toBeInstanceOf(BadRequestException);
      expect(mockEventsRepo.createEvent).not.toHaveBeenCalled();
    });

    it('should reject invalid percentage (>100) before creating the event', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      await expect(service.create({
        eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10,
        coupon: { enabled: true, discountType: 'PERCENTAGE', discountValue: 150 },
      } as any, 'user1')).rejects.toThrow(/between 1 and 100/);
      expect(mockEventsRepo.createEvent).not.toHaveBeenCalled();
    });

    it('should reject zero discount before creating the event', async () => {
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      await expect(service.create({
        eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10,
        coupon: { enabled: true, discountType: 'FIXED', discountValue: 0 },
      } as any, 'user1')).rejects.toThrow(BadRequestException);
      expect(mockEventsRepo.createEvent).not.toHaveBeenCalled();
    });
  });

  describe('status transitions', () => {
    it('should allow DRAFT -> PREVIEW', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: EventStatus.DRAFT, organizerId: 'org1' });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      mockEventsRepo.updateEventStatus.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: EventStatus.PREVIEW });
      const res = await service.preview('550e8400-e29b-41d4-a716-446655440000', 'user1');
      expect(res.status).toBe(EventStatus.PREVIEW);
    });

    it('should reject invalid transition PUBLISHED -> PREVIEW', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: EventStatus.PUBLISHED, organizerId: 'org1' });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      await expect(service.preview('550e8400-e29b-41d4-a716-446655440000', 'user1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow PREVIEW -> PUBLISHED', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: EventStatus.PREVIEW, organizerId: 'org1' });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockEventsRepo.updateEventStatus.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: EventStatus.PUBLISHED });
      const res = await service.publish('550e8400-e29b-41d4-a716-446655440000', 'user1');
      expect(res.status).toBe(EventStatus.PUBLISHED);
    });

    it('should enforce ownership on update', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', organizerId: 'org1', status: EventStatus.DRAFT });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org2' });
      await expect(service.update('550e8400-e29b-41d4-a716-446655440000', { eventName: 'New' } as any, 'user2')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should reject update on PUBLISHED event', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', organizerId: 'org1', status: EventStatus.PUBLISHED, date: new Date(), closingTime: new Date(Date.now() - 1000000) });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      await expect(service.update('550e8400-e29b-41d4-a716-446655440000', { eventName: 'New' } as any, 'user1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow updating paymentRequired on DRAFT event', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', organizerId: 'org1', status: EventStatus.DRAFT, date: new Date('2026-10-02T10:00:00Z'), closingTime: new Date('2026-10-01T10:00:00Z') });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      mockEventsRepo.updateEvent.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', paymentRequired: true });
      const res = await service.update('550e8400-e29b-41d4-a716-446655440000', { paymentRequired: true } as any, 'user1');
      expect(res.paymentRequired).toBe(true);
      expect(mockEventsRepo.updateEvent).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000', expect.objectContaining({ paymentRequired: true }));
    });

    it('should allow updating paymentRequired to false', async () => {
      mockEventsRepo.findEventById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', organizerId: 'org1', status: EventStatus.DRAFT, date: new Date('2026-10-02T10:00:00Z'), closingTime: new Date('2026-10-01T10:00:00Z') });
      mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      mockEventsRepo.updateEvent.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', paymentRequired: false });
      const res = await service.update('550e8400-e29b-41d4-a716-446655440000', { paymentRequired: false } as any, 'user1');
      expect(res.paymentRequired).toBe(false);
      expect(mockEventsRepo.updateEvent).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000', expect.objectContaining({ paymentRequired: false }));
    });
  });

  describe('public visibility', () => {
    it('findOnePublic should hide DRAFT', async () => {
      mockEventsRepo.findEventByIdWithOrganizer.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: EventStatus.DRAFT });
      await expect(service.findOnePublic('550e8400-e29b-41d4-a716-446655440000')).rejects.toBeInstanceOf(NotFoundException);
    });
    it('findOnePublic should allow PUBLISHED', async () => {
      mockEventsRepo.findEventByIdWithOrganizer.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: EventStatus.PUBLISHED, eventName: 'Published' });
      const res = await service.findOnePublic('550e8400-e29b-41d4-a716-446655440000');
      expect(res.eventName).toBe('Published');
    });
  });

  describe('validation', () => {
    it('should throw 400 for invalid ID type (handled by ParseIntPipe)', async () => {
      mockEventsRepo.findEventByIdWithOrganizer.mockResolvedValue(null);
      await expect(service.findOnePublic('00000000-0000-4000-a000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
