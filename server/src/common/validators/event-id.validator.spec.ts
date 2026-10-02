import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { ParseEventIdPipe } from '../pipes/parse-event-id.pipe';
import { IsEventId, isEventId } from './event-id.validator';
import { CreateWithdrawalDto } from '../../withdrawals/dto/create-withdrawal.dto';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('legacy event ID compatibility', () => {
  describe('isEventId', () => {
    it('1. accepts UUID event IDs', () => {
      expect(isEventId(UUID)).toBe(true);
    });

    it('2. accepts legacy integer event IDs', () => {
      expect(isEventId('17')).toBe(true);
      expect(isEventId('16')).toBe(true);
      expect(isEventId('007')).toBe(true);
    });

    it('3. rejects invalid event IDs', () => {
      for (const bad of ['abc', '', '17a', 'a17', '12 34', '12-34', '-', '  ', '17.5']) {
        expect(isEventId(bad)).toBe(false);
      }
      expect(isEventId(undefined)).toBe(false);
      expect(isEventId(null)).toBe(false);
      expect(isEventId(17)).toBe(false);
    });
  });

  describe('ParseEventIdPipe', () => {
    const pipe = new ParseEventIdPipe();

    it('passes UUIDs through unchanged', () => {
      expect(pipe.transform(UUID)).toBe(UUID);
    });

    it('passes legacy numeric IDs through unchanged', () => {
      expect(pipe.transform('17')).toBe('17');
    });

    it('rejects arbitrary invalid IDs with 400', () => {
      for (const bad of ['not-an-id', '', '17a']) {
        expect(() => pipe.transform(bad)).toThrow(BadRequestException);
      }
    });
  });

  describe('CreateWithdrawalDto eventId', () => {
    async function errorsFor(eventId: string) {
      const dto = new CreateWithdrawalDto();
      dto.eventId = eventId;
      dto.amount = 100;
      return validate(dto);
    }

    it('accepts UUID event IDs', async () => {
      expect(await errorsFor(UUID)).toHaveLength(0);
    });

    it('accepts legacy integer event IDs', async () => {
      expect(await errorsFor('17')).toHaveLength(0);
    });

    it('rejects invalid event IDs', async () => {
      const errors = await errorsFor('not-an-id');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.property).toBe('eventId');
    });
  });

  describe('IsEventId decorator', () => {
    it('flags non-string values', async () => {
      class Sample {
        @IsEventId()
        eventId!: unknown;
      }
      const dto = new Sample();
      dto.eventId = 17;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
