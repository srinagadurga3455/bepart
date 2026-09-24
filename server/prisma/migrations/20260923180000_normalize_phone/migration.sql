-- Normalize existing phone numbers: trim and remove spaces, hyphens, parentheses
-- Safe update: only where phone is not null, does not delete users
UPDATE "users" SET "phone" = regexp_replace(trim("phone"), '[\s\-\(\)]', '', 'g') WHERE "phone" IS NOT NULL;
UPDATE "organizers" SET "phone" = regexp_replace(trim("phone"), '[\s\-\(\)]', '', 'g') WHERE "phone" IS NOT NULL;
