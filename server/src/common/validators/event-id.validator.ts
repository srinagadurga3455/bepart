import {
  ValidationOptions,
  isUUID,
  registerDecorator,
} from 'class-validator';

/**
 * Event IDs are UUIDs for new events, but rows created before the Int→UUID
 * migration keep their legacy numeric IDs ("1", "2", ...) stored as text.
 * Accept both so legacy PUBLISHED events stay reachable — the database rows
 * are never rewritten.
 *
 * The Event PK is a string column: new rows use UUIDs, but rows created
 * before the UUID migration keep short numeric-string IDs (e.g. '16', '17').
 * Both formats must keep working.
 */
export const EVENT_ID_PATTERN =
  /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|\d+)$/;

const LEGACY_NUMERIC_ID_PATTERN = /^[0-9]+$/;

/** UUID (any version, like @IsUUID() default) or a legacy numeric-string ID. */
export function isEventId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return (
    EVENT_ID_PATTERN.test(trimmed) ||
    isUUID(trimmed) ||
    LEGACY_NUMERIC_ID_PATTERN.test(trimmed)
  );
}

/** class-validator decorator for event-ID DTO fields. */
export function IsEventId(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isEventId',
      target: (object as any).constructor,
      propertyName: propertyName as string,
      options: validationOptions ?? {
        message: '$property must be a valid event ID (UUID or legacy numeric ID)',
      },
      validator: {
        validate(value: unknown): boolean {
          return isEventId(value);
        },
      },
    });
  };
}
