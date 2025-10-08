-- AlterEnum: Remove 'standby' and add 'lab_support'
-- Create a new enum with the desired values
CREATE TYPE "DeviceStatus_new" AS ENUM ('pending', 'ready', 'deployed', 'broken', 'testing', 'lab_support');

-- Alter devices table: drop default, change type, restore default
ALTER TABLE "devices" ALTER COLUMN "current_status" DROP DEFAULT;
ALTER TABLE "devices" ALTER COLUMN "current_status" TYPE "DeviceStatus_new" USING ("current_status"::text::"DeviceStatus_new");
ALTER TABLE "devices" ALTER COLUMN "current_status" SET DEFAULT 'pending'::"DeviceStatus_new";

-- Alter device_status_history table
ALTER TABLE "device_status_history" ALTER COLUMN "status" TYPE "DeviceStatus_new" USING ("status"::text::"DeviceStatus_new");

-- Drop the old enum and rename the new one
DROP TYPE "DeviceStatus";
ALTER TYPE "DeviceStatus_new" RENAME TO "DeviceStatus";
