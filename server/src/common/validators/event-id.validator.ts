import { Matches, ValidationOptions } from 'class-validator';

// Event ids are UUIDs for new events, but rows created before the Int→UUID
// migration keep their legacy numeric ids ("1", "2", ...) stored as text.
// Accept both so legacy PUBLISHED events stay reachable.
export const EVENT_ID_PATTERN =
  /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|\d+)$/;

export function isEventId(value: unknown): value is string {
  return typeof value === 'string' && EVENT_ID_PATTERN.test(value.trim());
}

export function IsEventId(validationOptions?: ValidationOptions) {
  return Matches(EVENT_ID_PATTERN, {
    message: 'eventId must be a UUID or legacy numeric event ID',
    ...validationOptions,
  });
}
