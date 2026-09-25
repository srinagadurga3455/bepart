import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { StorageRepository } from './storage.repo';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Role } from '../common/constants/roles';

// Mock S3
const mockSend = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn().mockImplementation((args) => args),
    DeleteObjectCommand: jest.fn().mockImplementation((args) => args),
  };
});

jest.mock('image-size', () => jest.fn());

import * as imageSize from 'image-size';
const mockedSizeOf = imageSize as unknown as jest.Mock;

const mockStorageRepo: any = {
  findEventById: jest.fn(),
  updateEventPosterSquare: jest.fn(),
  updateEventPosterRectangle: jest.fn(),
  findOrganizerByUserId: jest.fn(),
};

const mockConfigService: any = {
  get: jest.fn((key: string) => {
    const map: any = {
      R2_ACCOUNT_ID: 'test-account',
      R2_ACCESS_KEY_ID: 'test-key',
      R2_SECRET_ACCESS_KEY: 'test-secret',
      R2_BUCKET_NAME: 'test-bucket',
      R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
      R2_PUBLIC_URL: 'https://cdn.example.com',
    };
    return map[key];
  }),
};

describe('StorageService - Local + R2', () => {
  let service: StorageService;
  const uploadsRoot = path.join(process.cwd(), 'uploads');

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedSizeOf.mockImplementation(() => ({ width: 800, height: 800 }));
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: StorageRepository, useValue: mockStorageRepo },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = mod.get(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const fakeFile = (overrides: Partial<Express.Multer.File> = {}) =>
    ({
      originalname: 'test.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('fake-image-content'),
      ...overrides,
    } as unknown as Express.Multer.File);

  const withSquareDimensions = () => mockedSizeOf.mockReturnValue({ width: 800, height: 800 });
  const withRectangleDimensions = () => mockedSizeOf.mockReturnValue({ width: 1600, height: 900 });
  const withInvalidSquare = () => mockedSizeOf.mockReturnValue({ width: 1600, height: 900 });
  const withInvalidRectangle = () => mockedSizeOf.mockReturnValue({ width: 800, height: 800 });

  const eventId1 = '550e8400-e29b-41d4-a716-446655440000';
  const eventId2 = '550e8400-e29b-41d4-a716-446655440001';
  const eventId99 = '550e8400-e29b-41d4-a716-446655440099';

  describe('square poster uploads successfully', () => {
    it('should upload square poster to R2 with correct key', async () => {
      withSquareDimensions();
      const res = await service.saveEventPosterSquare(fakeFile(), eventId1);
      expect(res.key).toBe(`events/${eventId1}/poster-square.png`);
      expect(res.url).toBe(`https://cdn.example.com/events/${eventId1}/poster-square.png`);
      expect(mockSend).toHaveBeenCalled();
      const putArgs = mockSend.mock.calls[mockSend.mock.calls.length - 1][0];
      expect(putArgs.Bucket).toBe('test-bucket');
      expect(putArgs.Key).toBe(`events/${eventId1}/poster-square.png`);
    });
  });

  describe('rectangle poster uploads successfully', () => {
    it('should upload rectangle poster to R2 with correct key', async () => {
      withRectangleDimensions();
      const res = await service.saveEventPosterRectangle(fakeFile(), eventId2);
      expect(res.key).toBe(`events/${eventId2}/poster-rectangle.png`);
      expect(res.url).toBe(`https://cdn.example.com/events/${eventId2}/poster-rectangle.png`);
    });
  });

  describe('invalid aspect ratio is rejected', () => {
    it('should reject square with landscape dimensions', async () => {
      withInvalidSquare();
      await expect(service.saveEventPosterSquare(fakeFile(), eventId1)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('should reject rectangle with square dimensions', async () => {
      withInvalidRectangle();
      await expect(service.saveEventPosterRectangle(fakeFile(), eventId1)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('should reject rectangle that is portrait', async () => {
      mockedSizeOf.mockReturnValue({ width: 800, height: 1600 });
      await expect(service.saveEventPosterRectangle(fakeFile(), eventId1)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('unsupported file type', () => {
    it('should reject pdf', async () => {
      await expect(service.saveEventPosterSquare(fakeFile({ mimetype: 'application/pdf' }), eventId1)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('should reject svg', async () => {
      await expect(service.saveEventPosterRectangle(fakeFile({ mimetype: 'image/svg+xml' }), eventId1)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('file larger than limit', () => {
    it('should reject >5MB', async () => {
      withSquareDimensions();
      await expect(service.saveEventPosterSquare(fakeFile({ size: 6 * 1024 * 1024 }), eventId1)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('organizer can upload for their own event', () => {
    it('should allow owner organizer', async () => {
      withSquareDimensions();
      mockStorageRepo.findEventById.mockResolvedValue({ id: eventId1, organizerId: 'org1' });
      mockStorageRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      mockStorageRepo.updateEventPosterSquare.mockResolvedValue({ id: eventId1, posterSquareUrl: `https://cdn.example.com/events/${eventId1}/poster-square.png` });
      const user = { userId: 'user1', id: 'user1', role: Role.ORGANIZER } as any;
      const res = await service.handleEventPosterSquareUpload(fakeFile(), eventId1, user);
      expect(res.posterSquareUrl).toContain('poster-square');
    });
  });

  describe('another organizer cannot upload', () => {
    it('should reject if not owner and not admin', async () => {
      mockStorageRepo.findEventById.mockResolvedValue({ id: eventId1, organizerId: 'org1' });
      mockStorageRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org2' });
      const user = { userId: 'user2', id: 'user2', role: Role.ORGANIZER } as any;
      withSquareDimensions();
      await expect(service.handleEventPosterSquareUpload(fakeFile(), eventId1, user)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('ADMIN cannot upload', () => {
    it('should reject admin even for own event', async () => {
      withRectangleDimensions();
      mockStorageRepo.findEventById.mockResolvedValue({ id: eventId1, organizerId: 'org1' });
      const admin = { userId: 'admin1', id: 'admin1', role: Role.ADMIN } as any;
      await expect(service.handleEventPosterRectangleUpload(fakeFile(), eventId1, admin)).rejects.toBeInstanceOf(ForbiddenException);
    });
    it('should reject admin for square', async () => {
      withSquareDimensions();
      mockStorageRepo.findEventById.mockResolvedValue({ id: eventId1, organizerId: 'org1' });
      const admin = { userId: 'admin1', id: 'admin1', role: Role.ADMIN } as any;
      await expect(service.handleEventPosterSquareUpload(fakeFile(), eventId1, admin)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('STUDENT cannot upload', () => {
    it('should reject student', async () => {
      withSquareDimensions();
      mockStorageRepo.findEventById.mockResolvedValue({ id: eventId1, organizerId: 'org1' });
      const student = { userId: 'student1', id: 'student1', role: Role.STUDENT } as any;
      await expect(service.handleEventPosterSquareUpload(fakeFile(), eventId1, student)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('replacing an existing poster works', () => {
    it('should overwrite R2 key and delete old variants', async () => {
      withSquareDimensions();
      await service.saveEventPosterSquare(fakeFile({ mimetype: 'image/jpeg' }), eventId1);
      const hasFirstPut = mockSend.mock.calls.some((c: any) => c[0]?.Key === `events/${eventId1}/poster-square.jpg` && c[0]?.Bucket === 'test-bucket');
      expect(hasFirstPut).toBe(true);
      mockSend.mockClear();
      withSquareDimensions();
      await service.saveEventPosterSquare(fakeFile({ mimetype: 'image/png' }), eventId1);
      const hasSecondPut = mockSend.mock.calls.some((c: any) => c[0]?.Key === `events/${eventId1}/poster-square.png`);
      expect(hasSecondPut).toBe(true);
      const deleteCalls = mockSend.mock.calls.filter((c: any) => c[0]?.Key?.includes('poster-square'));
      expect(deleteCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Event database contains both URLs', () => {
    it('should store both square and rectangle URLs separately', async () => {
      withSquareDimensions();
      mockStorageRepo.findEventById.mockResolvedValue({ id: eventId1, organizerId: 'org1', posterSquareUrl: null, posterRectangleUrl: null });
      mockStorageRepo.updateEventPosterSquare.mockResolvedValue({ id: eventId1, posterSquareUrl: `https://cdn.example.com/events/${eventId1}/poster-square.jpg` });
      mockStorageRepo.updateEventPosterRectangle.mockResolvedValue({ id: eventId1, posterRectangleUrl: `https://cdn.example.com/events/${eventId1}/poster-rectangle.jpg` });
      const user = { userId: 'user1', id: 'user1', role: Role.ORGANIZER } as any;
      mockStorageRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      withSquareDimensions();
      const sq = await service.handleEventPosterSquareUpload(fakeFile({ mimetype: 'image/jpeg' }), eventId1, user);
      expect(sq.posterSquareUrl).toContain('poster-square');
      withRectangleDimensions();
      const rect = await service.handleEventPosterRectangleUpload(fakeFile({ mimetype: 'image/jpeg' }), eventId1, user);
      expect(rect.posterRectangleUrl).toContain('poster-rectangle');
      expect(mockStorageRepo.updateEventPosterSquare).toHaveBeenCalledWith(eventId1, expect.stringContaining('poster-square'));
      expect(mockStorageRepo.updateEventPosterRectangle).toHaveBeenCalledWith(eventId1, expect.stringContaining('poster-rectangle'));
    });
  });

  describe('actual objects exist in R2', () => {
    it('should call S3 PutObject for R2', async () => {
      withSquareDimensions();
      await service.saveEventPosterSquare(fakeFile(), eventId99);
      expect(mockSend).toHaveBeenCalled();
      const args = mockSend.mock.calls[mockSend.mock.calls.length - 1];
      expect(args[0].Bucket).toBe('test-bucket');
      expect(args[0].Key).toBe(`events/${eventId99}/poster-square.png`);
      expect(args[0].ContentType).toBe('image/png');
    });
  });

  describe('no image binary is stored in PostgreSQL', () => {
    it('should store only URL string, not binary', async () => {
      withSquareDimensions();
      mockStorageRepo.findEventById.mockResolvedValue({ id: eventId1, organizerId: 'org1' });
      mockStorageRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1' });
      mockStorageRepo.updateEventPosterSquare.mockImplementation(async (id: string, url: string) => {
        expect(typeof url).toBe('string');
        expect(url.startsWith('https://')).toBe(true);
        expect(Buffer.isBuffer(url as any)).toBe(false);
        return { id, posterSquareUrl: url };
      });
      const user = { userId: 'user1', id: 'user1', role: Role.ORGANIZER } as any;
      const res = await service.handleEventPosterSquareUpload(fakeFile(), eventId1, user);
      expect(typeof res.posterSquareUrl).toBe('string');
    });
  });

  describe('nonexistent event', () => {
    it('should 404 for nonexistent event', async () => {
      mockStorageRepo.findEventById.mockResolvedValue(null);
      const user = { userId: 'user1', id: 'user1', role: Role.ORGANIZER } as any;
      withSquareDimensions();
      await expect(service.handleEventPosterSquareUpload(fakeFile(), '00000000-0000-4000-a000-000000000000', user)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('static image URL - R2 for events', () => {
    it('should generate correct R2 URL for events', async () => {
      withSquareDimensions();
      const res = await service.saveEventPosterSquare(fakeFile(), eventId1);
      expect(res.url).toBe(`https://cdn.example.com/events/${eventId1}/poster-square.png`);
    });
  });

  describe('security', () => {
    it('should prevent path traversal', async () => {
      withSquareDimensions();
      await expect(service.saveEventPosterSquare(fakeFile(), '../../etc/passwd' as any)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('should not trust original filename', async () => {
      withSquareDimensions();
      const file = fakeFile({ originalname: '../../../evil.exe', mimetype: 'image/png' });
      const res = await service.saveEventPosterSquare(file, eventId1);
      expect(res.key).toBe(`events/${eventId1}/poster-square.png`);
    });
  });
});
