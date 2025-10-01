# Argus - iOS Device Fleet Management System
## Project Plan & Architecture

## 1. Executive Summary

Argus is a fleet management system for tracking iOS devices (iPhones/iPads) used in the iOS Inspector project. It replaces the current Google Sheets solution with a proper database and web interface that maintains full historical records of devices, accounts, deployments, and maintenance activities.

## 2. Core Requirements

### 2.1 Device Management
- Track individual devices with unique internal serial numbers
- Store device metadata: type (iPhone/iPad), model, iOS version, Device ID
- Track device lifecycle states: deployed, standby, broken, testing
- Maintain complete history of device status changes
- Track maintenance events (battery replacements, repairs, etc.)

### 2.2 Account Management
- Track Apple ID accounts
- Store account metadata: country, status
- Link accounts to devices with full history
- Track account reassignments when devices are replaced

### 2.3 Deployment Management
- Track three Mac Mini hosts running iOS Inspector
- Assign devices to specific hosts
- Monitor deployment status
- Track deployment history (when device moved between hosts)

### 2.4 Health Monitoring (Future Phase)
- API endpoints for devices to ping their status
- Error logging and alerting
- Uptime tracking

### 2.5 Interface Requirements
- Progressive Web App (PWA) for desktop and iPad access
- Responsive, mobile-friendly UI
- Real-time updates
- Historical data visualization

## 3. System Architecture

### 3.1 High-Level Architecture
```
┌─────────────────┐
│   Web Client    │
│   (PWA/React)   │
└────────┬────────┘
         │
         │ HTTP/WebSocket
         │
┌────────▼────────┐
│   API Server    │
│   (Node.js)     │
└────────┬────────┘
         │
         │
┌────────▼────────┐
│   PostgreSQL    │
│   (Database)    │
└─────────────────┘
```

### 3.2 Technology Stack

**Backend:**
- Runtime: Node.js (v20+)
- Framework: Express.js or Fastify
- Database: PostgreSQL 15+
- ORM: Prisma or Drizzle ORM
- API: RESTful + optional WebSocket for real-time updates
- Authentication: None (closed network deployment)

**Frontend:**
- Framework: React 18+ with TypeScript
- Build Tool: Vite
- UI Library: shadcn/ui or Mantine
- State Management: TanStack Query (React Query) + Zustand
- Routing: React Router v6
- PWA: Vite PWA plugin

**DevOps:**
- Container: Docker + Docker Compose
- Development: Hot reload for both frontend and backend
- Production: Nginx reverse proxy

## 4. Database Schema

### 4.1 Core Tables

**devices**
```sql
- id (uuid, PK)
- internal_serial (varchar, unique, not null) -- e.g., "ARG-001"
- device_id (integer, unique, not null) -- iOS Inspector device number (1-63+)
- static_ip (varchar, nullable) -- Static IP address assigned to device
- device_type (enum: 'iphone', 'ipad')
- model (varchar) -- e.g., "iPhone 14 Pro"
- ios_version (varchar) -- e.g., "17.4.1"
- current_status (enum: 'deployed', 'standby', 'broken', 'testing')
- current_host_id (uuid, FK to hosts, nullable)
- current_account_id (uuid, FK to accounts, nullable)
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)
```

**accounts**
```sql
- id (uuid, PK)
- apple_id (varchar, unique, not null)
- country (varchar)
- status (enum: 'active', 'locked', 'disabled')
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)
```

**hosts**
```sql
- id (uuid, PK)
- name (varchar, unique, not null) -- e.g., "mac-mini-01"
- hostname (varchar)
- status (enum: 'online', 'offline', 'maintenance')
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)
```

### 4.2 History Tables

**device_status_history**
```sql
- id (uuid, PK)
- device_id (uuid, FK to devices)
- status (enum: same as devices.current_status)
- changed_at (timestamp)
- changed_by (varchar) -- user who made the change
- notes (text)
```

**device_account_history**
```sql
- id (uuid, PK)
- device_id (uuid, FK to devices)
- account_id (uuid, FK to accounts)
- assigned_at (timestamp)
- unassigned_at (timestamp, nullable)
- notes (text)
```

**device_host_history**
```sql
- id (uuid, PK)
- device_id (uuid, FK to devices)
- host_id (uuid, FK to hosts)
- deployed_at (timestamp)
- undeployed_at (timestamp, nullable)
- notes (text)
```

**maintenance_events**
```sql
- id (uuid, PK)
- device_id (uuid, FK to devices)
- event_type (enum: 'battery_replacement', 'screen_repair', 'other')
- description (text)
- performed_at (timestamp)
- performed_by (varchar)
- cost (decimal, nullable)
```

### 4.3 Future: Health Monitoring

**health_checks**
```sql
- id (uuid, PK)
- device_id (uuid, FK to devices)
- status (enum: 'healthy', 'warning', 'error')
- cpu_usage (decimal)
- memory_usage (decimal)
- battery_level (integer)
- error_message (text, nullable)
- checked_at (timestamp)
```

## 5. API Design

### 5.1 Core Endpoints

**Devices**
- `GET /api/devices` - List all devices (with filters)
- `GET /api/devices/:id` - Get device details
- `POST /api/devices` - Create new device
- `PATCH /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device (soft delete)
- `GET /api/devices/:id/history` - Get device history (all events)

**Accounts**
- `GET /api/accounts` - List all accounts
- `GET /api/accounts/:id` - Get account details
- `POST /api/accounts` - Create new account
- `PATCH /api/accounts/:id` - Update account
- `GET /api/accounts/:id/devices` - Get account device history

**Hosts**
- `GET /api/hosts` - List all hosts
- `GET /api/hosts/:id` - Get host details
- `POST /api/hosts` - Create new host
- `PATCH /api/hosts/:id` - Update host
- `GET /api/hosts/:id/devices` - Get devices on host

**Operations**
- `POST /api/devices/:id/assign-account` - Assign account to device
- `POST /api/devices/:id/assign-host` - Deploy device to host
- `POST /api/devices/:id/change-status` - Change device status
- `POST /api/devices/:id/maintenance` - Log maintenance event

**Health (Future)**
- `POST /api/health/:deviceId` - Device health check ping
- `GET /api/health/:deviceId/recent` - Recent health checks

### 5.2 Response Format
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

## 6. User Interface

### 6.1 Key Views

**Dashboard**
- Overview statistics (total devices, active, broken, etc.)
- Host status overview
- Recent activity feed
- Quick actions

**Device List**
- Filterable/searchable table
- Status indicators
- Quick view of current assignment (host + account)
- Bulk actions

**Device Detail**
- Full device information
- Current status, host, and account
- Complete history timeline
- Maintenance log
- Quick action buttons (change status, assign, etc.)

**Account Management**
- List of all accounts
- Show which devices use each account
- Account status indicators

**Host Management**
- List of Mac Mini hosts
- Show devices deployed to each
- Host status

**Maintenance Log**
- Chronological list of all maintenance events
- Filterable by device, type, date range

### 6.2 PWA Features
- Offline capability for viewing data
- Installable on iPad/desktop
- Responsive design (mobile-first)
- Push notifications for critical alerts (future)

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- ✓ Project setup and architecture design
- Set up development environment (Docker, databases)
- Initialize backend (Express + Prisma)
- Initialize frontend (React + Vite + PWA)
- Database schema implementation
- Basic CRUD API for devices, accounts, hosts

### Phase 2: Core Features (Week 3-4)
- History tracking implementation
- Device assignment operations
- Status change workflows
- Maintenance event logging

### Phase 3: User Interface (Week 5-6)
- Dashboard implementation
- Device management UI
- Account management UI
- Host management UI
- History timeline component
- Responsive design and PWA setup

### Phase 4: Polish & Testing (Week 7)
- Data validation and error handling
- Testing (unit + integration)
- Documentation
- Deployment setup

### Phase 5: Health Monitoring (Future)
- Health check API
- Health monitoring UI
- Alerting system
- Integration with iOS Inspector

## 8. Project Structure

```
argus/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── index.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── App.tsx
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
├── .env.example
├── PROJECT_PLAN.md
├── CLAUDE.md
└── README.md
```

## 9. Security Considerations

- No authentication required (closed network deployment)
- Input validation and sanitization
- SQL injection prevention (via ORM)
- Environment variable management
- Rate limiting on API endpoints (optional, for health checks)

## 10. Data Migration

- Export Google Sheets to CSV format
- Create CSV import script using REST API
- Script will parse CSV and POST to API endpoints
- Validate data integrity after migration
- Handle later in development cycle

## 11. Success Metrics

- All devices tracked with complete history
- Sub-second page load times
- 100% uptime for monitoring
- Mobile/iPad usability score > 90%
- Zero data loss incidents

## 12. Future Enhancements

- Health check system with alerting
- Automated device provisioning workflows
- Integration with iOS Inspector API
- Analytics and reporting dashboard
- Export functionality (CSV, PDF reports)
- Backup and restore functionality
- Multi-user support with permissions
- Audit logs for all changes