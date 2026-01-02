ALTER TABLE users
  ADD COLUMN IF NOT EXISTS login TEXT;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS login TEXT;

-- backfill logins from email prefix if empty
UPDATE users
SET login = split_part(email, '@', 1)
WHERE login IS NULL OR login = '';

UPDATE drivers
SET login = split_part(email, '@', 1)
WHERE login IS NULL OR login = '';

ALTER TABLE users
  ALTER COLUMN login SET NOT NULL;

ALTER TABLE drivers
  ALTER COLUMN login SET NOT NULL;

ALTER TABLE users
  ADD CONSTRAINT users_login_unique UNIQUE (login);

ALTER TABLE drivers
  ADD CONSTRAINT drivers_login_unique UNIQUE (login);
