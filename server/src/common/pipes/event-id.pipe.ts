import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { EVENT_ID_PATTERN } from '../validators/event-id.validator';

/**
 * Accepts new UUID event ids and legacy numeric ids ("1", "2", ...) left
 * over from the pre-UUID era. Rejects anything else with a 400.
 */
@Injectable()
export class ParseEventIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const id = typeof value === 'string' ? value.trim() : '';
    if (!id || !EVENT_ID_PATTERN.test(id)) {
      throw new BadRequestException('Invalid event ID (must be a UUID or legacy numeric ID)');
    }
    return id;
  }
}
