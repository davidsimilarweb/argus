# CLAUDE.md - Argus Project State

**Last Updated:** 2025-10-08
**Project Status:** Phase 3 - Planning Inspector Slots & Health Monitoring 🚀
**Current Phase:** Architectural Redesign - Slots System

## Project Overview

Argus is an iOS device fleet management system designed to replace the current Google Sheets solution for tracking iPhones and iPads used in the iOS Inspector project. The system provides comprehensive device tracking, Apple ID account management, deployment monitoring across three Mac Mini hosts, maintenance history, and **real-time health monitoring of iOS Inspector runtime slots**.

## Completed Work

### ✅ Phase 1: Foundation (2025-09-30)

**Backend Implementation:**
- ✅ Set up project structure with TypeScript
- ✅ Installed dependencies (Express, Prisma, CORS, dotenv, csv-parse)
- ✅ Configured TypeScript with proper settings
- ✅ Created Prisma schema with all 8 tables (devices, accounts, hosts, + 5 history tables)
- ✅ Set up Docker Compose with PostgreSQL 15
- ✅ Ran initial database migration successfully
- ✅ Built Express server with middleware (CORS, body parser, error handling)
- ✅ Implemented complete CRUD controllers for devices
- ✅ Implemented complete CRUD controllers for accounts
- ✅ Implemented complete CRUD controllers for hosts
- ✅ Created utility modules (Prisma client, API response helpers)
- ✅ Implemented device operation endpoints (assign/unassign account, assign/unassign host, change status, add maintenance)
- ✅ Added request logging middleware
- ✅ Enhanced Account model with password and twoFactor fields
- ✅ Made deviceId optional (Int?) in Device model
- ✅ Configured backend to listen on 0.0.0.0 for network access
- ✅ Created CSV import script for data migration (import:iphones)

**Frontend Implementation:**
- ✅ Created Vite + React + TypeScript project
- ✅ Installed dependencies (React Router, TanStack Query, Axios)
- ✅ Configured Vite with PWA plugin
- ✅ Set up API client with TypeScript interfaces for all entities
- ✅ Implemented React Router with 4 main routes
- ✅ Configured TanStack Query with React Query DevTools
- ✅ Built Dashboard page with statistics overview
- ✅ Built Devices page with modern card-based grid layout
- ✅ Built Accounts page with card-based grid layout
- ✅ Built Hosts page with card-based grid layout
- ✅ Created responsive navigation layout with mobile sidebar
- ✅ Styled application with custom "Illuminati neon" theme (#00ff9f accent)
- ✅ Configured API proxy in Vite for development
- ✅ Configured Vite to listen on 0.0.0.0 for network access

**DevOps & Documentation:**
- ✅ Created Docker Compose configuration
- ✅ Set up environment variables (.env files)
- ✅ Created .gitignore for both frontend and backend
- ✅ Wrote comprehensive README.md with setup instructions
- ✅ Documented all API endpoints
- ✅ Added troubleshooting section

### ✅ Phase 2: Core Features (2025-10-01 to 2025-10-08) - COMPLETE

**Forms & Modals Implemented:**
- ✅ Device creation form (modal with internal serial generator)
- ✅ Account creation form (modal with password & 2FA fields)
- ✅ Host creation form (modal)
- ✅ Device editing modal
- ✅ Account editing modal (via detail view)
- ✅ Host editing modal (via detail view)

**Device Operations UI:**
- ✅ Assign account to device modal interface
- ✅ Unassign account from device
- ✅ Assign host to device modal interface
- ✅ Unassign host from device
- ✅ Change device status modal interface
- ✅ Toast notification system implemented
- ❌ Add maintenance event form (backend ready, UI not implemented)

**Detail Views:**
- ✅ Device detail modal (click card to view)
- ✅ Account detail modal (shows password, 2FA, devices)
- ✅ Host detail modal (shows devices)
- ✅ Device history timeline component created
- ❌ Device detail page route (not modal-based)

**UI/UX Enhancements:**
- ✅ Modal component system created
- ✅ Status badges with visual states
- ✅ Card-based layout for all entity lists
- ✅ Responsive mobile design
- ✅ Network access for multi-device usage
- ✅ Toast notification system for success/error feedback
- ✅ Timeline component for displaying history
- ✅ QR code generation for devices
- ❌ Delete confirmations
- ❌ Loading states polish

**Advanced Filtering (2025-10-08):**
- ✅ Device filtering by status (pending, ready, deployed, broken, testing, lab_support)
- ✅ Device filtering by type (iPhone, iPad)
- ✅ Device filtering by host (with "Unassigned" option)
- ✅ Device filtering by country (via assigned account's country, with counts)
- ✅ Account filtering by status
- ✅ Account filtering by country (with counts)
- ✅ Search functionality across devices and accounts
- ✅ "Clear Filters" button

**Status System Enhancement:**
- ✅ Added "lab_support" device status (2025-10-08)
- ✅ Database migration to add new status
- ✅ Frontend TypeScript types updated
- ✅ UI styling for new status (purple color)
- ✅ Dashboard statistics updated

## Key Architectural Decisions

1. **PostgreSQL over MongoDB:** Chosen for strong relational data integrity, crucial for tracking device-account-host relationships and maintaining accurate history.

2. **Prisma ORM:** Selected for type-safe database queries, easy schema migrations, and excellent TypeScript integration.

3. **Progressive Web App:** Enables iPad usage as required, with offline capability for viewing data even without connectivity.

4. **History Tables Pattern:** Separate history tables for each relationship type rather than generic event log, allowing for efficient queries and clearer data model.

5. **Soft Deletes:** Implied in schema design to never lose historical data.

6. **Inspector Slots Architecture (2025-10-08):** Introduced separation between physical devices and iOS Inspector runtime slots to enable device swapping and targeted health monitoring.

## Current Architecture

### Entity Relationships (Current)
```
Host (Mac Mini)
  ├── Devices (currently assigned)
  └── Device History

Device (Physical iPhone/iPad)
  ├── Account (Apple ID credentials)
  ├── Host (deployment location)
  └── Status, IP, Serial

Account (Apple ID)
  └── Associated Devices
```

### Planned Architecture (Phase 3 - Inspector Slots)
```
Host (Mac Mini)
  └── InspectorSlots (numbered positions 1-81)
       └── Device (physical iPhone/iPad)
            └── Account (Apple ID credentials)

HealthCheck → InspectorSlot (not Device)
```

## Phase 3: Inspector Slots & Health Monitoring (PLANNING - 2025-10-08)

### Architectural Redesign

**Core Concept:**
- Separate **physical devices** (hardware assets) from **Inspector Slots** (runtime positions)
- iOS Inspector processes run in numbered slots (1-81+)
- Devices can be swapped in/out of slots without losing health monitoring history
- Health checks ping slots, not devices

### New Entity: InspectorSlot

**Properties:**
- `slotNumber`: Globally unique (1, 2, 3... 81+)
- `hostId`: Which Mac Mini this slot runs on
- `status`: active, warning, error, stopped, timeout
- `currentDeviceId`: Which physical device is currently in this slot (nullable)
- `lastHealthCheck`: Timestamp of last ping
- `lastErrorMessage`: Most recent error for quick display

**Slot Distribution:**
- Mac Mini 1: Slots 1-31 (slotOffset=0, slotCount=31)
- Mac Mini 2: Slots 32-61 (slotOffset=31, slotCount=30)
- Mac Mini 3: Slots 62-81 (slotOffset=61, slotCount=20)

### Health Check System Design

**Three-State Health Reporting:**
1. **OK**: Everything working normally
2. **WARNING**: Degraded performance but functional (high CPU, low battery, slow tests)
3. **ERROR**: Critical failure, not functioning

**Health Check Payload:**
```json
{
  "status": "warning|ok|error",
  "errorMessage": "High CPU usage detected (95%)",
  "errorType": "performance|network|auth|battery|crash",
  "cpuUsage": 95.8,
  "memoryUsage": 72.1,
  "batteryLevel": 25,
  "responseTime": 450,
  "metadata": { /* any additional data */ }
}
```

**Slot Status States:**
- **active** (green): Running normally, last check was OK
- **warning** (yellow): Running with warnings, degraded performance
- **error** (red): Critical error reported
- **stopped** (gray): Manually stopped/disabled
- **timeout** (orange): Expected active but not responding (>10 min)

### Key Design Decisions

1. **Static IP belongs to Device, not Slot**
   - Physical constraint: can't have two devices with same IP
   - Default: IP = `10.0.1.{slotNumber + 100}`
   - Can be manually changed as needed
   - When swapping devices, iOS Inspector config must update to new IP

2. **deviceId field = slotNumber**
   - The iOS Inspector instance number
   - Physical device identifier = `internalSerial` (ARG-001, ARG-002)
   - Slot numbers are globally unique and sequential

3. **Slots are pre-created per Host**
   - Hosts define `slotCount` and `slotOffset`
   - Slots auto-generated based on host configuration
   - Sequential numbering ensures no conflicts

4. **Remove Device-Host direct relationship**
   - Devices no longer directly assigned to hosts
   - Devices connect to hosts via slots
   - Cleaner separation of concerns

5. **Account stays with Device**
   - Manual login process on physical device
   - When swapping devices, new device brings its own account
   - Slot doesn't "own" credentials

### Planned API Endpoints

**Slot Management:**
```
GET    /api/slots                      # List all slots with current devices
GET    /api/slots/:id                  # Get slot details
POST   /api/slots/:id/assign-device    # Assign device to slot
POST   /api/slots/:id/unassign-device  # Remove device from slot
PATCH  /api/slots/:id                  # Update slot status/notes
POST   /api/slots/:id/stop             # Manually stop slot
POST   /api/slots/:id/start            # Manually start slot
```

**Health Monitoring:**
```
POST   /api/slots/:slotNumber/health   # iOS Inspector pings this (by slot number)
GET    /api/slots/:id/health-history   # Get health history for a slot
GET    /api/health/summary              # Dashboard overview of all slot health
POST   /api/slots/:id/acknowledge-error # Mark error as acknowledged
```

**Dynamic Configuration (NEW):**
```
GET    /api/slots/:slotNumber/config   # iOS Inspector fetches device/account config
```

This endpoint returns:
- Device information (IP, model, iOS version)
- Account credentials (Apple ID, password, 2FA)
- Slot status and host information
- Enables iOS Inspector to fetch config dynamically instead of hardcoded values

**Host Management (Updated):**
```
POST   /api/hosts/:id/initialize-slots # Create slots for this host
PATCH  /api/hosts/:id/slot-config      # Update slotCount/slotOffset
```

### Planned Database Changes

**New Tables:**
- `inspector_slots` - Runtime slot definitions
- `slot_device_history` - Track which devices were in each slot over time

**Modified Tables:**
- `hosts` - Add `slotCount` and `slotOffset` fields
- `devices` - Remove `currentHostId` and `deviceId` fields
- `health_checks` - Change foreign key from `deviceId` to `slotId`

**Removed Relationships:**
- Device → Host direct assignment (replaced by Device → Slot → Host)
- HealthCheck → Device (replaced by HealthCheck → Slot)

### Planned UI Changes

**New Pages:**
1. **Slots Page** - Grid view of all 81+ slots
   - Color-coded by status (green/yellow/red/gray/orange)
   - Shows slot number, host, assigned device
   - Click to view details or assign/unassign devices
   - Health status indicators

**Updated Pages:**
1. **Dashboard**
   - Add slot health overview section
   - Active slots: 55/81
   - Health breakdown: 50 healthy, 3 warning, 2 error
   - Recent errors list

2. **Devices Page**
   - Show "Assigned to Slot #X" or "Unassigned"
   - Add filter: assigned/unassigned to slots
   - Remove host filter (replaced by slot assignment)

3. **Hosts Page**
   - Show slot range (e.g., "Slots 1-31")
   - Add "Initialize Slots" button
   - Show slot health summary per host

**New Components:**
- Slot detail modal with health history
- Slot assignment interface
- Health status timeline
- Real-time health monitoring dashboard

### iOS Inspector Integration

**Startup Flow:**
```python
SLOT_NUMBER = 5  # Only hardcoded value

# Fetch configuration dynamically
config = requests.get(f"{ARGUS_API}/slots/{SLOT_NUMBER}/config").json()

# Extract device and account info
device_ip = config['device']['staticIp']
apple_id = config['account']['appleId']
password = config['account']['password']
two_factor = config['account']['twoFactor']

# Run tests and report health
while True:
    try:
        run_tests()
        report_health(status="ok", battery=get_battery())
    except Exception as e:
        report_health(status="error", error_message=str(e))
    time.sleep(60)
```

**Warning Detection Examples:**
- Battery < 20%: Report warning with "Battery critically low"
- CPU > 90%: Report warning with "High CPU usage"
- Tests 2x slower: Report warning with "Performance degraded"
- Intermittent network issues: Report warning with "Network unstable"

### Workflow Examples

**Scenario 1: Device Swap**
```
1. Device ARG-001 battery dies while in Slot 5
2. Operator unassigns ARG-001 from Slot 5
3. Operator marks ARG-001 status as "broken"
4. Operator gets replacement device ARG-045 (ready status)
5. Operator assigns ARG-045 to Slot 5
6. iOS Inspector process reads new config (new IP: 10.0.1.145)
7. Slot 5 continues health monitoring seamlessly
8. Health history preserved for Slot 5 across device swap
```

**Scenario 2: Health Monitoring**
```
1. iOS Inspector Slot 12 reports high CPU (95%)
2. Health check endpoint receives warning status
3. Slot 12 status changes to "warning" (yellow)
4. Dashboard shows 1 slot with warning
5. Operator investigates, finds memory leak
6. Operator manually stops Slot 12
7. Slot 12 status changes to "stopped" (gray)
8. Fix applied, operator restarts Slot 12
9. Slot 12 reports "ok", status changes to "active" (green)
```

## Implementation Timeline

- **Phase 1 (Foundation):** ✅ COMPLETE (2025-09-30) - Setup, database, basic CRUD, UI foundation
- **Phase 2 (Core Features):** ✅ COMPLETE (2025-10-01 to 2025-10-08) - Forms, operations, filtering, status system
- **Phase 3 (Inspector Slots):** 🎯 PLANNING (2025-10-08) - Architectural redesign, slots system, health monitoring
  - [ ] Database schema migration (add slots, update relationships)
  - [ ] Backend: Slot CRUD controllers
  - [ ] Backend: Health check endpoints
  - [ ] Backend: Dynamic config endpoint
  - [ ] Backend: Slot assignment logic
  - [ ] Backend: Timeout detection job
  - [ ] Frontend: Slots page UI
  - [ ] Frontend: Health monitoring dashboard
  - [ ] Frontend: Update Devices/Hosts pages
  - [ ] Frontend: Slot assignment interface
- **Phase 4 (Testing):** Upcoming - Data migration, testing, deployment
- **Phase 5 (Future):** TBD - Advanced analytics, alerting, WebSocket real-time updates

## Technical Decisions & Constraints

### Device & Slot Management

1. **Authentication:** ✅ No authentication needed - closed network deployment
2. **Deployment Environment:** ✅ Local deployment on macOS within closed network
3. **Static IP Assignment:** ✅ Per device (physical constraint), default = slot# + 100
4. **Slot Numbering:** ✅ Sequential across hosts (1-31, 32-61, 62-81)
5. **Account Assignment:** ✅ Stays with device (manual login process)
6. **Device States:**
   - `pending` - New device, not yet assigned
   - `ready` - Available for slot assignment
   - `deployed` - Currently in an active slot
   - `lab_support` - Used for lab testing (not in slot)
   - `broken` - Removed from slot, needs repair
   - `testing` - Being tested before deployment

### Health Monitoring

1. **Health Check Frequency:** iOS Inspector pings every 60 seconds
2. **Timeout Threshold:** 10 minutes without health check = timeout status
3. **Status Levels:** OK (green), Warning (yellow), Error (red), Stopped (gray), Timeout (orange)
4. **Error Types:** network, auth, performance, battery, crash, custom
5. **Data Retention:** Keep all health check history (with indexes for performance)
6. **Real-time Updates:** Future consideration - WebSocket for live dashboard

## Current System Status

**Backend:** ✅ Running on http://localhost:3000
- All CRUD endpoints operational
- Device, Account, Host management complete
- Device operations (assign account/host, change status)
- Ready for slots migration

**Frontend:** ✅ Running on http://localhost:5173
- Dashboard with real-time statistics
- Device management with advanced filtering
- Account management with country filtering
- Host management interface
- Toast notifications
- Timeline component
- PWA configured and ready

**Database:** ✅ PostgreSQL running
- Current schema: 8 tables (devices, accounts, hosts, + 5 history tables)
- Ready for slots migration

## Project Structure

```
argus/
├── backend/
│   ├── src/
│   │   ├── controllers/      # API route handlers
│   │   ├── routes/           # Express routes
│   │   ├── utils/            # Helpers (Prisma, responses)
│   │   └── index.ts          # Server entry point
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema (will be updated for slots)
│   │   └── migrations/       # Schema migrations
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/       # React components (Modal, Timeline)
│   │   ├── contexts/         # React contexts (Settings)
│   │   ├── hooks/            # Custom hooks (useToast)
│   │   ├── lib/              # API client, types
│   │   ├── pages/            # Page components (Dashboard, Devices, Accounts, Hosts)
│   │   └── App.tsx           # Main app component
│   └── package.json
├── docker-compose.yml        # PostgreSQL container
├── PROJECT_PLAN.md           # Complete technical specification
├── CLAUDE.md                 # This file - project state tracker
├── SLOTS_PLAN.md             # Detailed slots & health monitoring design (to be created)
└── README.md                 # User documentation
```

## Next Steps

### Immediate (Phase 3 Implementation)

1. **Create SLOTS_PLAN.md** - Detailed implementation guide with database schema, API specs, UI mockups
2. **Database Migration** - Add InspectorSlot model, update relationships
3. **Backend Implementation** - Slot controllers, health check endpoints, timeout detection
4. **Frontend Implementation** - Slots page, health dashboard, updated filtering
5. **Testing** - Unit tests, integration tests, iOS Inspector integration testing

### Future Considerations

- Push notifications for critical slot errors
- Advanced analytics (slot uptime, error patterns)
- Automated device replacement recommendations
- Slack/email alerts for timeout/error states
- Historical reporting (slot health over time)
- WebSocket real-time updates for live monitoring
- Automated backup system
- Capacity planning tools (predict when new hosts needed)

## Resources & References

- **Prisma Docs:** https://www.prisma.io/docs
- **Vite PWA:** https://vite-pwa-org.netlify.app
- **shadcn/ui:** https://ui.shadcn.com
- **TanStack Query:** https://tanstack.com/query/latest

## Notes

- Project codename "Argus" chosen after the many-eyed giant from Greek mythology, fitting for a monitoring system
- PWA requirement driven by need for iPad usage in the device rack area
- History tracking is critical - main improvement over Google Sheets
- System designed to scale to ~100-200 devices initially
- Inspector Slots architecture enables device swapping without losing monitoring history
- Health check system provides real-time visibility into iOS Inspector fleet health
- Dynamic configuration endpoint eliminates hardcoded configs in iOS Inspector
