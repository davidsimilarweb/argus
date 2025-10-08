-- AlterEnum: Add new value 'pending' and 'ready', rename 'standby' usage
ALTER TYPE "DeviceStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "DeviceStatus" ADD VALUE IF NOT EXISTS 'ready';

-- Update existing 'standby' devices to 'ready'
UPDATE "devices" SET "current_status" = 'ready' WHERE "current_status" = 'standby';
UPDATE "device_status_history" SET "status" = 'ready' WHERE "status" = 'standby';

-- Note: Cannot remove 'standby' from enum in PostgreSQL directly
-- The old value remains in the enum but is no longer used
