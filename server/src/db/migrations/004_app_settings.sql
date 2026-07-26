-- Admin-editable application settings that are not pay rates.
--
-- First use is the document-email test recipient (メール設定): the address an
-- admin points document mail at while checking that delivery works. Kept as a
-- generic key/value table so the next such setting does not need a migration.
--
-- Values are nullable: a row with a NULL value means "explicitly cleared",
-- which reads the same as absent to the application.
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
