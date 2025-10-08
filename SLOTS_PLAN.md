# Inspector Slots & Health Monitoring - Implementation Plan

**Created:** 2025-10-08
**Status:** Planning Phase
**Related:** CLAUDE.md, PROJECT_PLAN.md

## Executive Summary

This document outlines the implementation plan for Phase 3 of the Argus project: the Inspector Slots system and Health Monitoring. This architectural redesign separates physical device assets from iOS Inspector runtime slots, enabling device swapping, centralized health monitoring, and dynamic configuration.

## Problem Statement

**Current Limitation:**
- Devices are directly assigned to hosts
- No distinction between physical hardware and runtime instances
- Health monitoring tied to devices (which may not be deployed)
- Device swaps lose monitoring history
- iOS Inspector uses hardcoded configurations

**Solution:**
- Introduce `InspectorSlot` as runtime execution positions
- Slots belong to hosts and can have devices assigned/unassigned
- Health checks target slots, not devices
- Device swaps preserve slot health history
- Dynamic configuration endpoint eliminates hardcoded values

## Architecture Overview

### Three-Tier Hierarchy

```
Host (Physical Mac Mini)
  └── InspectorSlot (Runtime position with slot number)
       └── Device (Physical iPhone/iPad)
            └── Account (Apple ID credentials)
```

### Key Relationships

- **Host → InspectorSlot**: One-to-many (Host has multiple slots)
- **InspectorSlot → Device**: One-to-one or null (Slot can have 0 or 1 device)
- **Device → Account**: Many-to-one (Multiple devices can share account, but typically 1:1)
- **HealthCheck → InspectorSlot**: Many-to-one (Health checks target slots)

### Entity Responsibilities

| Entity | Purpose | Key Properties |
|--------|---------|----------------|
| Host | Physical Mac Mini server | name, hostname, slotCount, slotOffset |
| InspectorSlot | Runtime iOS Inspector instance | slotNumber, status, lastHealthCheck |
| Device | Physical iPhone/iPad hardware | internalSerial, staticIp, iosVersion |
| Account | Apple ID credentials | appleId, password, twoFactor, country |
| HealthCheck | Health status report | status, errorMessage, errorType, metrics |

## Database Schema

### Complete Prisma Schema

```prisma
// ============================================
// ENUMS
// ============================================

enum DeviceType {
  iphone
  ipad
}

enum DeviceStatus {
  pending       // New device, not assigned
  ready         // Available for slot assignment
  deployed      // Currently in an active slot
  broken        // Removed from slot, needs repair
  testing       // Being tested before deployment
  lab_support   // Used for lab testing (not in slot)
}

enum AccountStatus {
  active
  locked
  disabled
}

enum HostStatus {
  online
  offline
  maintenance
}

enum SlotStatus {
  active      // Running normally (last check was OK)
  warning     // Running with warnings (degraded)
  error       // Critical error reported
  stopped     // Manually stopped/disabled
  timeout     // Expected active but not responding
}

enum HealthStatus {
  ok          // Everything working fine
  warning     // Minor issues, still functional
  error       // Critical failure
}

enum MaintenanceEventType {
  battery_replacement
  screen_repair
  other
}

// ============================================
// CORE MODELS
// ============================================

model Host {
  id           String     @id @default(uuid())
  name         String     @unique
  hostname     String?
  status       HostStatus @default(offline)
  slotCount    Int        @default(0) @map("slot_count")     // Number of slots on this host
  slotOffset   Int        @default(0) @map("slot_offset")    // Starting slot number
  notes        String?
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  slots        InspectorSlot[]

  @@map("hosts")
}

model InspectorSlot {
  id               String        @id @default(uuid())
  slotNumber       Int           @unique @map("slot_number")  // Globally unique: 1, 2, 3...
  hostId           String        @map("host_id")
  status           SlotStatus    @default(stopped)
  currentDeviceId  String?       @unique @map("current_device_id")
  lastHealthCheck  DateTime?     @map("last_health_check")
  lastErrorMessage String?       @map("last_error_message")
  notes            String?
  createdAt        DateTime      @default(now()) @map("created_at")
  updatedAt        DateTime      @updatedAt @map("updated_at")

  host             Host          @relation(fields: [hostId], references: [id], onDelete: Cascade)
  currentDevice    Device?       @relation("SlotCurrentDevice", fields: [currentDeviceId], references: [id])

  healthChecks     HealthCheck[]
  slotHistory      SlotDeviceHistory[]

  @@map("inspector_slots")
  @@index([hostId])
  @@index([status])
  @@index([slotNumber])
}

model Device {
  id                String   @id @default(uuid())
  internalSerial    String   @unique @map("internal_serial")  // ARG-001, ARG-002
  staticIp          String?  @unique @map("static_ip")        // 10.0.1.101, etc
  deviceType        DeviceType @map("device_type")
  model             String?
  iosVersion        String?  @map("ios_version")
  currentStatus     DeviceStatus @default(pending) @map("current_status")
  currentAccountId  String?  @map("current_account_id")
  notes             String?
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // Removed: currentHostId, deviceId

  currentAccount    Account? @relation("DeviceCurrentAccount", fields: [currentAccountId], references: [id])
  currentSlot       InspectorSlot? @relation("SlotCurrentDevice")

  statusHistory     DeviceStatusHistory[]
  accountHistory    DeviceAccountHistory[]
  slotHistory       SlotDeviceHistory[]
  maintenanceEvents MaintenanceEvent[]

  @@map("devices")
  @@index([currentStatus])
  @@index([deviceType])
}

model Account {
  id           String   @id @default(uuid())
  appleId      String   @unique @map("apple_id")
  country      String?
  status       AccountStatus @default(active)
  password     String?
  twoFactor    String? @map("two_factor")
  notes        String?
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  currentDevices Device[] @relation("DeviceCurrentAccount")
  deviceHistory  DeviceAccountHistory[]

  @@map("accounts")
}

// ============================================
// HISTORY TRACKING
// ============================================

model DeviceStatusHistory {
  id         String   @id @default(uuid())
  deviceId   String   @map("device_id")
  status     DeviceStatus
  changedAt  DateTime @default(now()) @map("changed_at")
  changedBy  String?  @map("changed_by")
  notes      String?

  device     Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@map("device_status_history")
  @@index([deviceId, changedAt])
}

model DeviceAccountHistory {
  id           String    @id @default(uuid())
  deviceId     String    @map("device_id")
  accountId    String    @map("account_id")
  assignedAt   DateTime  @default(now()) @map("assigned_at")
  unassignedAt DateTime? @map("unassigned_at")
  notes        String?

  device       Device    @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  account      Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@map("device_account_history")
  @@index([deviceId])
  @@index([accountId])
}

model SlotDeviceHistory {
  id           String    @id @default(uuid())
  slotId       String    @map("slot_id")
  deviceId     String    @map("device_id")
  assignedAt   DateTime  @default(now()) @map("assigned_at")
  unassignedAt DateTime? @map("unassigned_at")
  notes        String?

  slot         InspectorSlot @relation(fields: [slotId], references: [id], onDelete: Cascade)
  device       Device        @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@map("slot_device_history")
  @@index([slotId])
  @@index([deviceId])
  @@index([assignedAt])
}

model MaintenanceEvent {
  id          String   @id @default(uuid())
  deviceId    String   @map("device_id")
  eventType   MaintenanceEventType @map("event_type")
  description String
  performedAt DateTime @default(now()) @map("performed_at")
  performedBy String?  @map("performed_by")
  cost        Float?

  device      Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@map("maintenance_events")
  @@index([deviceId])
}

// ============================================
// HEALTH MONITORING
// ============================================

model HealthCheck {
  id            String       @id @default(uuid())
  slotId        String       @map("slot_id")
  status        HealthStatus
  errorMessage  String?      @map("error_message")
  errorType     String?      @map("error_type")
  metadata      Json?        // Any additional data (CPU, battery, custom metrics, etc.)
  checkedAt     DateTime     @default(now()) @map("checked_at")

  slot          InspectorSlot @relation(fields: [slotId], references: [id], onDelete: Cascade)

  @@map("health_checks")
  @@index([slotId, checkedAt])
  @@index([status])
}

// ============================================
// SETTINGS
// ============================================

model Settings {
  id        String   @id @default(uuid())
  key       String   @unique
  value     String
  updatedAt DateTime @updatedAt @map("updated_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("settings")
}
```

## API Specification

### Slot Management Endpoints

#### `GET /api/slots`
List all inspector slots with current devices and health status.

**Query Parameters:**
- `hostId` (optional): Filter by host
- `status` (optional): Filter by slot status
- `includeDevice` (optional, default: true): Include device details

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "slotNumber": 5,
      "status": "active",
      "lastHealthCheck": "2025-10-08T12:30:00Z",
      "lastErrorMessage": null,
      "host": {
        "id": "uuid-host",
        "name": "mac-mini-1"
      },
      "currentDevice": {
        "id": "uuid-device",
        "internalSerial": "ARG-001",
        "staticIp": "10.0.1.105",
        "model": "iPhone 12",
        "currentAccount": {
          "appleId": "test@icloud.com",
          "country": "US"
        }
      }
    }
  ]
}
```

#### `GET /api/slots/:id`
Get detailed slot information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-1",
    "slotNumber": 5,
    "status": "warning",
    "lastHealthCheck": "2025-10-08T12:35:00Z",
    "lastErrorMessage": "High CPU usage (95%)",
    "notes": "Monitoring CPU issue",
    "host": { /* host details */ },
    "currentDevice": { /* device with account */ },
    "recentHealthChecks": [
      {
        "status": "warning",
        "errorMessage": "High CPU usage (95%)",
        "cpuUsage": 95.8,
        "batteryLevel": 25,
        "checkedAt": "2025-10-08T12:35:00Z"
      }
    ]
  }
}
```

#### `POST /api/slots/:id/assign-device`
Assign a device to a slot.

**Request Body:**
```json
{
  "deviceId": "uuid-device",
  "notes": "Replacing broken device"
}
```

**Logic:**
1. Verify device is not already assigned to another slot
2. Unassign previous device from this slot (if any)
3. Assign new device to slot
4. Create SlotDeviceHistory entry
5. Update slot status based on assignment

**Response:**
```json
{
  "success": true,
  "data": {
    "slot": { /* updated slot */ },
    "previousDevice": { /* if any */ },
    "newDevice": { /* assigned device */ }
  }
}
```

#### `POST /api/slots/:id/unassign-device`
Remove device from slot.

**Request Body:**
```json
{
  "notes": "Device needs repair"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "slot": { /* updated slot with no device */ },
    "unassignedDevice": { /* removed device */ }
  }
}
```

#### `PATCH /api/slots/:id`
Update slot properties.

**Request Body:**
```json
{
  "status": "stopped",
  "notes": "Under maintenance"
}
```

#### `POST /api/slots/:id/start`
Manually start a stopped slot.

**Response:**
```json
{
  "success": true,
  "data": {
    "slotNumber": 5,
    "status": "active",
    "message": "Slot started successfully"
  }
}
```

#### `POST /api/slots/:id/stop`
Manually stop a running slot.

**Request Body:**
```json
{
  "reason": "Maintenance required"
}
```

### Health Monitoring Endpoints

#### `POST /api/slots/:slotNumber/health`
iOS Inspector reports health status (uses slotNumber, not UUID).

**Request Body:**
```json
{
  "status": "warning",
  "errorMessage": "High CPU usage detected (95%)",
  "errorType": "performance",
  "cpuUsage": 95.8,
  "memoryUsage": 72.1,
  "batteryLevel": 25,
  "responseTime": 450,
  "metadata": {
    "slowTests": ["test_app_launch"],
    "averageTestDuration": "4.5s"
  }
}
```

**Backend Logic:**
1. Find slot by slotNumber
2. Create HealthCheck entry
3. Update InspectorSlot:
   - `lastHealthCheck = now()`
   - `status = 'active' | 'warning' | 'error'` (based on health status)
   - `lastErrorMessage = errorMessage` (if warning/error)
4. Return acknowledgment

**Response:**
```json
{
  "success": true,
  "data": {
    "slotNumber": 5,
    "acknowledged": true,
    "currentStatus": "warning"
  }
}
```

#### `GET /api/slots/:slotNumber/config`
iOS Inspector fetches dynamic configuration (uses slotNumber).

**Response:**
```json
{
  "success": true,
  "data": {
    "slotNumber": 5,
    "host": {
      "id": "uuid-host",
      "name": "mac-mini-1",
      "hostname": "mac-mini-1.local"
    },
    "device": {
      "id": "uuid-device",
      "internalSerial": "ARG-001",
      "staticIp": "10.0.1.105",
      "deviceType": "iphone",
      "model": "iPhone 12",
      "iosVersion": "17.2"
    },
    "account": {
      "id": "uuid-account",
      "appleId": "test.account@icloud.com",
      "password": "SecurePass123",
      "twoFactor": "ABCD-EFGH-IJKL-MNOP",
      "country": "US"
    },
    "slotStatus": "active",
    "lastHealthCheck": "2025-10-08T12:30:00Z"
  }
}
```

**When no device assigned:**
```json
{
  "success": true,
  "data": {
    "slotNumber": 5,
    "host": { /* host info */ },
    "device": null,
    "account": null,
    "slotStatus": "stopped",
    "message": "No device assigned to this slot"
  }
}
```

#### `GET /api/slots/:id/health-history`
Get health check history for a slot.

**Query Parameters:**
- `limit` (default: 100): Number of records
- `status` (optional): Filter by health status
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-check",
      "status": "error",
      "errorMessage": "Connection timeout",
      "errorType": "network",
      "cpuUsage": 12.1,
      "batteryLevel": 45,
      "checkedAt": "2025-10-08T12:35:00Z"
    }
  ]
}
```

#### `GET /api/health/summary`
Dashboard health summary across all slots.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSlots": 81,
    "activeSlots": 55,
    "warningSlots": 3,
    "errorSlots": 2,
    "stoppedSlots": 20,
    "timeoutSlots": 1,
    "byHost": {
      "mac-mini-1": {
        "total": 31,
        "active": 25,
        "warning": 2,
        "error": 1,
        "stopped": 2,
        "timeout": 1
      }
    },
    "recentErrors": [
      {
        "slotNumber": 5,
        "slotId": "uuid-slot",
        "errorMessage": "Connection timeout",
        "errorType": "network",
        "occurredAt": "2025-10-08T12:35:00Z",
        "device": "ARG-001"
      }
    ]
  }
}
```

#### `POST /api/slots/:id/acknowledge-error`
Mark error as acknowledged by operator.

**Request Body:**
```json
{
  "notes": "Investigating network issue"
}
```

### Host Management Endpoints (Updated)

#### `POST /api/hosts/:id/initialize-slots`
Create inspector slots for a host.

**Request Body:**
```json
{
  "slotCount": 31,
  "slotOffset": 0
}
```

**Logic:**
1. Update host with slotCount and slotOffset
2. Create slots: slotNumber = slotOffset + 1 to slotOffset + slotCount
3. Set all slots to status='stopped'
4. Return created slots

**Response:**
```json
{
  "success": true,
  "data": {
    "host": { /* updated host */ },
    "slotsCreated": 31,
    "slotRange": "1-31"
  }
}
```

## Frontend Implementation

### New Pages

#### Slots Page (`/slots`)

**Layout:**
- Grid view of all slots (responsive: 4-6 columns)
- Each slot card shows:
  - Slot number (large, prominent)
  - Host name
  - Status badge (color-coded)
  - Assigned device (or "Unassigned")
  - Last health check timestamp
  - Click to open detail modal

**Color Coding:**
- Green: `active` (healthy)
- Yellow: `warning` (degraded)
- Red: `error` (critical)
- Gray: `stopped` (manually disabled)
- Orange: `timeout` (not responding)

**Filters:**
- By host
- By status
- Assigned/Unassigned
- Search by slot number

**Example Component:**
```tsx
<div className="slots-grid">
  {slots.map(slot => (
    <div
      className={`slot-card status-${slot.status}`}
      onClick={() => openSlotDetail(slot)}
    >
      <div className="slot-number">#{slot.slotNumber}</div>
      <div className="slot-host">{slot.host.name}</div>
      <div className={`status-badge status-${slot.status}`}>
        {slot.status}
      </div>
      {slot.currentDevice ? (
        <div className="slot-device">{slot.currentDevice.internalSerial}</div>
      ) : (
        <div className="slot-empty">Unassigned</div>
      )}
      <div className="slot-health">
        {slot.lastHealthCheck
          ? formatTimeAgo(slot.lastHealthCheck)
          : 'No data'}
      </div>
    </div>
  ))}
</div>
```

#### Slot Detail Modal

**Sections:**
1. **Overview**
   - Slot number, host, status
   - Assigned device details
   - Last health check time

2. **Actions**
   - Assign Device (button → opens device picker)
   - Unassign Device
   - Start/Stop Slot
   - Acknowledge Error

3. **Health History**
   - Timeline of recent health checks
   - Filterable by status
   - Shows error messages, metrics

4. **Device History**
   - List of devices that have been in this slot
   - Assignment/unassignment dates

### Updated Pages

#### Dashboard Updates

Add "Slot Health" section:

```tsx
<div className="slot-health-section">
  <h3>Inspector Slots</h3>
  <div className="health-overview">
    <div className="health-stat active">
      <span className="count">{summary.activeSlots}</span>
      <span className="label">Active</span>
    </div>
    <div className="health-stat warning">
      <span className="count">{summary.warningSlots}</span>
      <span className="label">Warning</span>
    </div>
    <div className="health-stat error">
      <span className="count">{summary.errorSlots}</span>
      <span className="label">Error</span>
    </div>
    <div className="health-stat stopped">
      <span className="count">{summary.stoppedSlots}</span>
      <span className="label">Stopped</span>
    </div>
  </div>

  {summary.recentErrors.length > 0 && (
    <div className="recent-errors">
      <h4>Recent Errors</h4>
      {summary.recentErrors.map(error => (
        <div className="error-item">
          <span className="slot-num">Slot #{error.slotNumber}</span>
          <span className="error-msg">{error.errorMessage}</span>
          <span className="time">{formatTimeAgo(error.occurredAt)}</span>
        </div>
      ))}
    </div>
  )}
</div>
```

#### Devices Page Updates

1. **Show slot assignment:**
```tsx
<div className="device-card">
  {/* existing content */}
  <div className="device-slot">
    {device.currentSlot ? (
      <span className="slot-badge">
        Slot #{device.currentSlot.slotNumber}
      </span>
    ) : (
      <span className="unassigned">Unassigned</span>
    )}
  </div>
</div>
```

2. **Update filters:**
- Remove: Host filter (now irrelevant)
- Add: Slot assignment filter (assigned/unassigned)

#### Hosts Page Updates

1. **Show slot range and status:**
```tsx
<div className="host-card">
  <h3>{host.name}</h3>
  <div className="host-slots">
    <span className="slot-range">
      Slots {getSlotRange(host)}
    </span>
    <span className="slot-health">
      {getSlotHealthSummary(host)}
    </span>
  </div>
  {!host.slots || host.slots.length === 0 && (
    <button onClick={() => initializeSlots(host)}>
      Initialize Slots
    </button>
  )}
</div>
```

### New Components

#### SlotPicker Component
Modal for assigning device to slot:
- Shows available slots (without devices)
- Filterable by host
- Shows slot number and status

#### DevicePicker Component
Modal for choosing device to assign to slot:
- Shows available devices (status = 'ready' or 'deployed')
- Filterable by type, status
- Shows device details

#### HealthTimeline Component
Visual timeline of health checks:
- Color-coded dots for status
- Hover to see details
- Click to expand error message

## Migration Strategy

### Phase 1: Schema Migration

1. **Create new tables:**
   - `inspector_slots`
   - `slot_device_history`

2. **Modify existing tables:**
   - `hosts`: Add `slotCount`, `slotOffset`
   - Remove `DeviceHostHistory` table (replaced by `SlotDeviceHistory`)

3. **Update `health_checks`:**
   - Change `deviceId` to `slotId`

4. **Remove from `devices`:**
   - `currentHostId` field
   - `deviceId` field

### Phase 2: Data Migration Script

```typescript
// Migration script to move existing data to slots

async function migrateToSlots() {
  // 1. Create slots for each host
  const hosts = await prisma.host.findMany();

  for (const host of hosts) {
    // Determine slot range based on host name
    let slotCount = 0;
    let slotOffset = 0;

    if (host.name === 'mac-mini-1') {
      slotCount = 31;
      slotOffset = 0;
    } else if (host.name === 'mac-mini-2') {
      slotCount = 30;
      slotOffset = 31;
    }

    // Update host
    await prisma.host.update({
      where: { id: host.id },
      data: { slotCount, slotOffset }
    });

    // Create slots
    for (let i = 1; i <= slotCount; i++) {
      const slotNumber = slotOffset + i;
      await prisma.inspectorSlot.create({
        data: {
          slotNumber,
          hostId: host.id,
          status: 'stopped'
        }
      });
    }
  }

  // 2. Migrate devices to slots
  const devices = await prisma.device.findMany({
    where: { deviceId: { not: null } }
  });

  for (const device of devices) {
    if (device.deviceId) {
      const slot = await prisma.inspectorSlot.findUnique({
        where: { slotNumber: device.deviceId }
      });

      if (slot) {
        // Assign device to slot
        await prisma.inspectorSlot.update({
          where: { id: slot.id },
          data: {
            currentDeviceId: device.id,
            status: device.currentStatus === 'deployed' ? 'active' : 'stopped'
          }
        });

        // Create history entry
        await prisma.slotDeviceHistory.create({
          data: {
            slotId: slot.id,
            deviceId: device.id,
            assignedAt: device.createdAt
          }
        });
      }
    }
  }

  console.log('Migration completed!');
}
```

### Phase 3: Update API Endpoints

1. Update device controllers to remove host assignment logic
2. Add slot controllers
3. Add health monitoring endpoints
4. Test all endpoints

### Phase 4: Frontend Migration

1. Add Slots page
2. Update Dashboard
3. Update Devices page
4. Update Hosts page
5. Test all flows

## Testing Plan

### Backend Tests

1. **Slot CRUD Operations:**
   - Create slots for host
   - Assign/unassign devices
   - Update slot status
   - Delete slots

2. **Health Check Endpoints:**
   - Submit health check (ok, warning, error)
   - Verify slot status updates
   - Fetch health history
   - Fetch summary

3. **Dynamic Config:**
   - Fetch config for slot with device
   - Fetch config for empty slot
   - Verify account credentials returned

### Frontend Tests

1. **Slots Page:**
   - Display all slots
   - Filter by status/host
   - Click to view details
   - Assign/unassign devices

2. **Health Monitoring:**
   - View health status colors
   - View error messages
   - View health history timeline

3. **Integration:**
   - Assign device to slot → device page shows slot
   - Remove device from slot → slot shows unassigned
   - Health check updates dashboard in real-time

### iOS Inspector Integration Test

1. Start iOS Inspector with slot number
2. Fetch config from Argus
3. Verify device IP, account received
4. Submit health check (ok)
5. Verify Argus updates slot status
6. Submit health check (error)
7. Verify error appears in dashboard

## Rollout Plan

### Week 1: Backend Implementation
- Database migration
- Slot controllers
- Health check endpoints
- Dynamic config endpoint
- Data migration script

### Week 2: Frontend Implementation
- Slots page UI
- Dashboard updates
- Device/Host page updates
- Component library updates

### Week 3: Testing & Integration
- Unit tests
- Integration tests
- iOS Inspector integration
- Bug fixes

### Week 4: Deployment
- Production database migration
- Deploy backend
- Deploy frontend
- Monitor health checks
- Gather feedback

## Success Metrics

1. **Functionality:**
   - All 81+ slots created successfully
   - Devices assignable/unassignable from slots
   - Health checks received and processed
   - Dynamic config fetched by iOS Inspector

2. **Performance:**
   - Health check endpoint responds < 100ms
   - Config endpoint responds < 200ms
   - Dashboard loads health summary < 500ms

3. **Reliability:**
   - Timeout detection catches non-responsive slots
   - Error messages displayed accurately
   - History preserved across device swaps

4. **User Experience:**
   - Operators can swap devices in < 30 seconds
   - Health status visible at a glance
   - Errors easily investigated via UI

## Future Enhancements

1. **Real-time Updates:** WebSocket for live health status
2. **Alerting:** Slack/email notifications for errors
3. **Analytics:** Uptime reports, error patterns, performance trends
4. **Automation:** Auto-assign replacement devices for errors
5. **Capacity Planning:** Predict when new hosts needed
6. **Mobile App:** Dedicated iOS/Android app for monitoring
