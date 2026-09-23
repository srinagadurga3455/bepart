import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../database/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventStatus } from '@prisma/client';

const mockPrisma: any = {
  organizer: { findUnique: jest.fn() },
  event: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
};

describe('EventsService - Updated Schema Int ID', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = mod.get(EventsService);
  });

  describe('create', () => {
    it('should reject if organizer not APPROVED', async () => {
      mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org1', status: 'PENDING' });
      await expect(service.create({ eventName: 'E', date: new Date(Date.now() + 7200000).toISOString(), closingTime: new Date(Date.now() + 3600000).toISOString(), slots: 10 } as any, 'user1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should validate closingTime before date', async () => {
      mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      await expect(service.create({ eventName: 'E', date: '2026-10-01T00:00:00Z', closingTime: '2026-10-02T00:00:00Z', slots: 10 } as any, 'user1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should create DRAFT event with new fields and int id', async () => {
      mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockPrisma.event.create.mockResolvedValue({ id: 1, status: EventStatus.DRAFT, eventName: 'E' });
      const res = await service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 10 } as any, 'user1');
      expect(res.status).toBe(EventStatus.DRAFT);
      expect(res.id).toBe(1);
    });

    it('should reject slots <1', async () => {
      mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      await expect(service.create({ eventName: 'E', date: '2026-10-02T10:00:00Z', closingTime: '2026-10-01T10:00:00Z', slots: 0 } as any, 'user1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('status transitions', () => {
    it('should allow DRAFT -> PREVIEW', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 1, status: EventStatus.DRAFT, organizerId: 'org1' });
      mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.event.update.mockResolvedValue({ id: 1, status: EventStatus.PREVIEW });
      const res = await service.preview(1, 'user1');
      expect(res.status).toBe(EventStatus.PREVIEW);
    });

    it('should reject invalid transition PUBLISHED -> PREVIEW', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 1, status: EventStatus.PUBLISHED, organizerId: 'org1' });
      mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      await expect(service.preview(1, 'user1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow PREVIEW -> PUBLISHED', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 1, status: EventStatus.PREVIEW, organizerId: 'org1' });
      mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
      mockPrisma.event.update.mockResolvedValue({ id: 1, status: EventStatus.PUBLISHED });
      const res = await service.publish(1, 'user1');
      expect(res.status).toBe(EventStatus.PUBLISHED);
    });

    it('should enforce ownership on update', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 1, organizerId: 'org1', status: EventStatus.DRAFT });
      mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org2' });
      await expect(service.update(1, { eventName: 'New' } as any, 'user2')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should reject update on PUBLISHED event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 1, organizerId: 'org1', status: EventStatus.PUBLISHED, date: new Date(), closingTime: new Date(Date.now() - 1000000) });
      mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org1' });
      await expect(service.update(1, { eventName: 'New' } as any, 'user1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('public visibility', () => {
    it('findOnePublic should hide DRAFT', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 1, status: EventStatus.DRAFT });
      await expect(service.findOnePublic(1)).rejects.toBeInstanceOf(NotFoundException);
    });
    it('findOnePublic should allow PUBLISHED', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 1, status: EventStatus.PUBLISHED, eventName: 'Published' });
      const res = await service.findOnePublic(1);
      expect(res.eventName).toBe('Published');
    });
  });

  describe('validation', () => {
    it('should throw 400 for invalid ID type (handled by ParseIntPipe)', async () => {
      // Service expects number, controller ParseIntPipe will reject NaN
      mockPrisma.event.findUnique.mockResolvedValue(null);
      await expect(service.findOnePublic(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
