ALTER TABLE fines ADD COLUMN IF NOT EXISTS amount numeric(12, 2);
ALTER TABLE fines ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE fines ADD COLUMN IF NOT EXISTS issued_by text NOT NULL DEFAULT current_user;

UPDATE fines SET amount = 100.00 WHERE amount IS NULL;
UPDATE fines SET reason = 'Не вказано' WHERE reason IS NULL;

ALTER TABLE fines ALTER COLUMN amount SET NOT NULL;
ALTER TABLE fines ALTER COLUMN reason SET NOT NULL;

ALTER TABLE fines DROP CONSTRAINT IF EXISTS fines_status_check;
ALTER TABLE fines ADD CONSTRAINT fines_status_check
  CHECK (status IN ('Очікує сплати', 'В процесі', 'Оплачено', 'Відмінено', 'Прострочено'));

ALTER TABLE fines DROP CONSTRAINT IF EXISTS fines_amount_check;
ALTER TABLE fines ADD CONSTRAINT fines_amount_check CHECK (amount > 0);
