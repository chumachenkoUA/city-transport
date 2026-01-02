CREATE TABLE IF NOT EXISTS budgets (
  id BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL,
  income NUMERIC(14,2) NOT NULL DEFAULT 0,
  expenses NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  UNIQUE (month),
  CHECK (income >= 0),
  CHECK (expenses >= 0)
);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  occurred_at TIMESTAMP NOT NULL DEFAULT now(),
  document_ref TEXT,
  CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS salary_payments (
  id BIGSERIAL PRIMARY KEY,
  driver_id BIGINT REFERENCES drivers(id),
  employee_name TEXT,
  employee_role TEXT,
  rate NUMERIC(12,2),
  units INTEGER,
  total NUMERIC(12,2) NOT NULL,
  paid_at TIMESTAMP NOT NULL DEFAULT now(),
  CHECK (total > 0),
  CHECK (rate IS NULL OR rate > 0),
  CHECK (units IS NULL OR units > 0),
  CHECK (driver_id IS NOT NULL OR employee_name IS NOT NULL)
);
