import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { ForbiddenException } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsRepository } from './events.repo';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateRegistrationDto } from '../registrations/dto/create-registration.dto';
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

const mockCouponsService: any = { create: jest.fn() };
const mockCouponsRepo: any = {
  findByEvent: jest.fn().mockResolvedValue([]),
  findByCode: jest.fn().mockResolvedValue(null),
  hasActiveCouponForEvent: jest.fn().mockResolvedValue(false),
};

const futureISO = (daysAhead: number): string =>
  new Date(Date.now() + daysAhead * 24 * 3600 * 1000).toISOString();

const baseDto = (): any => ({
  eventName: 'E',
  date: futureISO(3),
  closingTime: futureISO(2),
  slots: 10,
});

describe('EventsService - WhatsApp group link', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCouponsRepo.findByEvent.mockResolvedValue([]);
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

  it('creates an event with a WhatsApp group link', async () => {
    mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
    mockEventsRepo.createEvent.mockResolvedValue({ id: 'e1', status: EventStatus.DRAFT });
    await service.create({ ...baseDto(), whatsappGroupLink: 'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv' } as any, 'user1');
    expect(mockEventsRepo.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappGroupLink: 'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv' }),
    );
  });

  it('creates an event without a group link (stored as null)', async () => {
    mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
    mockEventsRepo.createEvent.mockResolvedValue({ id: 'e1', status: EventStatus.DRAFT });
    await service.create(baseDto() as any, 'user1');
    expect(mockEventsRepo.createEvent).toHaveBeenCalledWith(expect.objectContaining({ whatsappGroupLink: null }));
  });

  it('trims the link on create', async () => {
    mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED' });
    mockEventsRepo.createEvent.mockResolvedValue({ id: 'e1', status: EventStatus.DRAFT });
    await service.create({ ...baseDto(), whatsappGroupLink: '  https://chat.whatsapp.com/abc  ' } as any, 'user1');
    expect(mockEventsRepo.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappGroupLink: 'https://chat.whatsapp.com/abc' }),
    );
  });

  it('updates the group link', async () => {
    mockEventsRepo.findEventById.mockResolvedValue({ id: 'e1', organizerId: 'org1', date: new Date(futureISO(3)), closingTime: new Date(futureISO(2)) });
    mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
    mockEventsRepo.updateEvent.mockResolvedValue({ id: 'e1' });
    await service.update('e1', { whatsappGroupLink: 'https://chat.whatsapp.com/xyz' } as any, 'user1');
    expect(mockEventsRepo.updateEvent).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ whatsappGroupLink: 'https://chat.whatsapp.com/xyz' }),
    );
  });

  it('removes the group link (null clears it)', async () => {
    mockEventsRepo.findEventById.mockResolvedValue({ id: 'e1', organizerId: 'org1', date: new Date(futureISO(3)), closingTime: new Date(futureISO(2)) });
    mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
    mockEventsRepo.updateEvent.mockResolvedValue({ id: 'e1', whatsappGroupLink: null });
    await service.update('e1', { whatsappGroupLink: null } as any, 'user1');
    expect(mockEventsRepo.updateEvent).toHaveBeenCalledWith('e1', expect.objectContaining({ whatsappGroupLink: null }));
  });

  it('removes the group link (empty string clears it)', async () => {
    mockEventsRepo.findEventById.mockResolvedValue({ id: 'e1', organizerId: 'org1', date: new Date(futureISO(3)), closingTime: new Date(futureISO(2)) });
    mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
    mockEventsRepo.updateEvent.mockResolvedValue({ id: 'e1', whatsappGroupLink: null });
    await service.update('e1', { whatsappGroupLink: '   ' } as any, 'user1');
    expect(mockEventsRepo.updateEvent).toHaveBeenCalledWith('e1', expect.objectContaining({ whatsappGroupLink: null }));
  });

  it('leaves the link untouched when the update omits it', async () => {
    mockEventsRepo.findEventById.mockResolvedValue({ id: 'e1', organizerId: 'org1', date: new Date(futureISO(3)), closingTime: new Date(futureISO(2)) });
    mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
    mockEventsRepo.updateEvent.mockResolvedValue({ id: 'e1' });
    await service.update('e1', { eventName: 'New' } as any, 'user1');
    const [, payload] = mockEventsRepo.updateEvent.mock.calls[0];
    expect(payload).not.toHaveProperty('whatsappGroupLink');
  });

  it('rejects a non-owner (participant) trying to set the link', async () => {
    mockEventsRepo.findEventById.mockResolvedValue({ id: 'e1', organizerId: 'org1', date: new Date(), closingTime: new Date() });
    mockEventsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'orgX' });
    await expect(
      service.update('e1', { whatsappGroupLink: 'https://chat.whatsapp.com/evil' } as any, 'user2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockEventsRepo.updateEvent).not.toHaveBeenCalled();
  });

  it('existing events with a null link still load publicly', async () => {
    mockEventsRepo.findEventByIdWithOrganizer.mockResolvedValue({
      id: 'e1',
      eventName: 'Old Event',
      status: EventStatus.PUBLISHED,
      isActive: true,
      whatsappGroupLink: null,
      organizer: { id: 'org1', name: 'Club', isActive: true },
    });
    const res: any = await service.findOnePublic('e1');
    expect(res.whatsappGroupLink).toBeNull();
    expect(res.eventName).toBe('Old Event');
  });

  it('participant registration DTO exposes no group-link field', () => {
    expect('whatsappGroupLink' in new CreateRegistrationDto()).toBe(false);
  });

  describe('CreateEventDto validation', () => {
    const validDto = (): CreateEventDto => {
      const dto = new CreateEventDto();
      dto.eventName = 'E';
      dto.date = futureISO(3);
      dto.closingTime = futureISO(2);
      dto.slots = 10;
      return dto;
    };

    it('accepts a valid chat.whatsapp.com URL', async () => {
      const dto = validDto();
      dto.whatsappGroupLink = 'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv';
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts an absent link', async () => {
      expect(await validate(validDto())).toHaveLength(0);
    });

    it('rejects an invalid URL', async () => {
      const dto = validDto();
      dto.whatsappGroupLink = 'not-a-url';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'whatsappGroupLink')).toBe(true);
    });
  });
});
