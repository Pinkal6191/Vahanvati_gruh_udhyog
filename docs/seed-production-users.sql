-- ====================================================================
-- Vahanvati Gruh Udhyog — Production Initial Staff Users & Walk-in Customer
-- Purpose: Safely populate admin, outlet, and production user accounts
-- ====================================================================

BEGIN;

-- 1. System Default Walk-in Customer (Required for POS billing counter)
INSERT INTO "customers" ("id", "name", "customer_type", "mobile", "city", "country", "notes", "is_active", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000099', 'Walk-in Customer', 'INDIAN', '0000000000', 'Local', 'India', 'System default counter customer', TRUE, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- 2. Initial Staff and Admin Accounts
-- Default Passwords:
--   admin      -> Admin@123
--   outlet     -> Outlet@123
--   production -> Production@123
INSERT INTO "users" ("id", "username", "full_name", "email", "password_hash", "role", "is_active", "created_at", "updated_at")
VALUES 
  ('7dd3911f-0d81-4809-8e30-f4572df32add', 'admin', 'Super Administrator', 'admin@vahanvati.com', '$2a$10$UnY9arzxwqGXZsrEO3qKkOX4tnXSQKr3RXjfqQWuNR09r.c.iot8C', 'ADMIN', TRUE, NOW(), NOW()),
  ('73d7954d-a55d-4bdc-9720-4b79254b562b', 'outlet', 'Counter Staff', 'counter@vahanvati.com', '$2a$10$UnY9arzxwqGXZsrEO3qKkO.QZlkp6rvbDKtV0FQw/uDNudmyCq0Hi', 'OUTLET', TRUE, NOW(), NOW()),
  ('0e44f479-11cf-4648-931e-d8210b5a9260', 'production', 'Kitchen Production Manager', 'kitchen@vahanvati.com', '$2a$10$UnY9arzxwqGXZsrEO3qKkOYOGtu8LvY6FI5CDOQHPGWZOTdlgEwb2', 'PRODUCTION', TRUE, NOW(), NOW())
ON CONFLICT ("username") DO UPDATE SET 
  "password_hash" = EXCLUDED."password_hash",
  "is_active" = TRUE,
  "updated_at" = NOW();

COMMIT;
