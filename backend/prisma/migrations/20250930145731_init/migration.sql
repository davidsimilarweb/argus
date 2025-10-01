-- CreateEnum
CREATE TYPE "public"."DeviceType" AS ENUM ('iphone', 'ipad');

-- CreateEnum
CREATE TYPE "public"."DeviceStatus" AS ENUM ('deployed', 'standby', 'broken', 'testing');

-- CreateEnum
CREATE TYPE "public"."AccountStatus" AS ENUM ('active', 'locked', 'disabled');

-- CreateEnum
CREATE TYPE "public"."HostStatus" AS ENUM ('online', 'offline', 'maintenance');

-- CreateEnum
CREATE TYPE "public"."MaintenanceEventType" AS ENUM ('battery_replacement', 'screen_repair', 'other');

-- CreateEnum
CREATE TYPE "public"."HealthStatus" AS ENUM ('healthy', 'warning', 'error');

-- CreateTable
CREATE TABLE "public"."devices" (
    "id" TEXT NOT NULL,
    "internal_serial" TEXT NOT NULL,
    "device_id" INTEGER NOT NULL,
    "static_ip" TEXT,
    "device_type" "public"."DeviceType" NOT NULL,
    "model" TEXT,
    "ios_version" TEXT,
    "current_status" "public"."DeviceStatus" NOT NULL DEFAULT 'standby',
    "current_host_id" TEXT,
    "current_account_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "apple_id" TEXT NOT NULL,
    "country" TEXT,
    "status" "public"."AccountStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hosts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostname" TEXT,
    "status" "public"."HostStatus" NOT NULL DEFAULT 'offline',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."device_status_history" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "status" "public"."DeviceStatus" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" TEXT,
    "notes" TEXT,

    CONSTRAINT "device_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."device_account_history" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "device_account_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."device_host_history" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "host_id" TEXT NOT NULL,
    "deployed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undeployed_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "device_host_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."maintenance_events" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "event_type" "public"."MaintenanceEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performed_by" TEXT,
    "cost" DOUBLE PRECISION,

    CONSTRAINT "maintenance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."health_checks" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "status" "public"."HealthStatus" NOT NULL,
    "cpu_usage" DOUBLE PRECISION,
    "memory_usage" DOUBLE PRECISION,
    "battery_level" INTEGER,
    "error_message" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_internal_serial_key" ON "public"."devices"("internal_serial");

-- CreateIndex
CREATE UNIQUE INDEX "devices_device_id_key" ON "public"."devices"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_apple_id_key" ON "public"."accounts"("apple_id");

-- CreateIndex
CREATE UNIQUE INDEX "hosts_name_key" ON "public"."hosts"("name");

-- AddForeignKey
ALTER TABLE "public"."devices" ADD CONSTRAINT "devices_current_host_id_fkey" FOREIGN KEY ("current_host_id") REFERENCES "public"."hosts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."devices" ADD CONSTRAINT "devices_current_account_id_fkey" FOREIGN KEY ("current_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."device_status_history" ADD CONSTRAINT "device_status_history_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."device_account_history" ADD CONSTRAINT "device_account_history_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."device_account_history" ADD CONSTRAINT "device_account_history_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."device_host_history" ADD CONSTRAINT "device_host_history_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."device_host_history" ADD CONSTRAINT "device_host_history_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."maintenance_events" ADD CONSTRAINT "maintenance_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."health_checks" ADD CONSTRAINT "health_checks_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
