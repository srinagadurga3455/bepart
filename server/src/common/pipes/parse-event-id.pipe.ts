import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isEventId } from '../validators/event-id.validator';

/**
 * Accepts UUID event IDs and legacy numeric-string event IDs (e.g. '17').
 * Strictly narrower than a plain string: arbitrary values are still rejected.
 * Withdrawal/payment/ticket/registration IDs stay on ParseUUIDPipe.
 */
@Injectable()
export class ParseEventIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (isEventId(value)) return value;
    throw new BadRequestException('eventId must be a valid event ID (UUID or legacy numeric ID)');
  }
}
