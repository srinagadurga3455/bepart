import {
  ValidationOptions,
  isUUID,
  registerDecorator,
} from 'class-validator';

/**
 * Legacy event-ID compatibility.
 *
 * The Event PK is a string column: new rows use UUIDs, but rows created
 * before the UUID migration keep short numeric-string IDs (e.g. '16', '17').
 * Both formats must keep working — the database rows are never rewritten.
 */
const LEGACY_NUMERIC_ID_PATTERN = /^[0-9]+$/;

/** UUID (any version, like @IsUUID() default) or a legacy numeric-string ID. */
export function isEventId(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  return isUUID(value) || LEGACY_NUMERIC_ID_PATTERN.test(value);
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
