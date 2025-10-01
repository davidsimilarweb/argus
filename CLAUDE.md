# CLAUDE.md - Argus Project State

**Last Updated:** 2025-10-01
**Project Status:** Phase 2 Core Features ~70% Complete 🚀
**Current Phase:** Phase 2 - Finishing Core Features & Moving to Phase 3

## Project Overview

Argus is an iOS device fleet management system designed to replace the current Google Sheets solution for tracking iPhones and iPads used in the iOS Inspector project. The system will provide comprehensive device tracking, Apple ID account management, deployment monitoring across three Mac Mini hosts, and maintenance history.

## Completed Work

### ✅ Planning & Architecture (2025-09-30)

1. **Requirements Analysis**
   - Analyzed current pain points with Google Sheets approach
   - Identified core entities: Devices, Accounts, Hosts
   - Defined device lifecycle states: deployed, standby, broken, testing
   - Outlined future health monitoring requirements

2. **System Architecture Design**
   - Chose three-tier architecture: React frontend, Node.js backend, PostgreSQL database
   - Selected technology stack optimized for PWA requirements
   - Designed RESTful API structure
   - Planned for future WebSocket integration for real-time updates

3. **Database Schema Design**
   - Created comprehensive schema with 8 core tables
   - Designed full history tracking for status changes, account assignments, and host deployments
   - Planned maintenance events logging
   - Prepared for future health check data structure

4. **Technology Stack Selection**
   - **Backend:** Node.js + Express/Fastify + Prisma ORM + PostgreSQL
   - **Frontend:** React 18 + TypeScript + Vite + shadcn/ui + TanStack Query
   - **PWA:** Vite PWA plugin for offline capability and installability
   - **DevOps:** Docker + Docker Compose for easy development and deployment

5. **API Design**
   - Defined RESTful endpoints for all CRUD operations
   - Planned operation endpoints for assignments and status changes
   - Prepared health check API structure for future implementation
   - Standardized response format

6. **UI/UX Planning**
   - Dashboard with overview statistics
   - Device list with filtering and search
   - Device detail view with complete history timeline
   - Account and host management interfaces
   - Maintenance log view
   - Mobile-first responsive design

7. **Documentation**
   - Created comprehensive PROJECT_PLAN.md with full architecture
   - Defined 5-phase implementation roadmap
   - Documented security considerations
   - Planned data migration from Google Sheets

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

## Key Architectural Decisions

1. **PostgreSQL over MongoDB:** Chosen for strong relational data integrity, crucial for tracking device-account-host relationships and maintaining accurate history.

2. **Prisma ORM:** Selected for type-safe database queries, easy schema migrations, and excellent TypeScript integration.

3. **Progressive Web App:** Enables iPad usage as required, with offline capability for viewing data even without connectivity.

4. **History Tables Pattern:** Separate history tables for each relationship type rather than generic event log, allowing for efficient queries and clearer data model.

5. **Soft Deletes:** Implied in schema design to never lose historical data.

## Project Structure

```
argus/
├── backend/           # Node.js API server
├── frontend/          # React PWA application
├── docker-compose.yml # Development environment setup
├── PROJECT_PLAN.md    # Complete technical specification
├── CLAUDE.md          # This file - project state tracker
└── README.md          # (To be created) User documentation
```

## Current System Status

**Backend:** ✅ Running on http://localhost:3000
- All CRUD endpoints operational
- Database connected and migrated
- 15+ API endpoints available

**Frontend:** ✅ Running on http://localhost:5173
- Dashboard with real-time statistics
- Device management interface
- Account management interface
- Host management interface
- PWA configured and ready

**Database:** ✅ PostgreSQL running in Docker
- 8 tables created and migrated
- Ready for data entry

### ✅ Phase 2: Core Features (2025-10-01) - ~70% COMPLETE

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
- ❌ Add maintenance event form (backend ready, UI not implemented)

**Detail Views:**
- ✅ Device detail modal (click card to view)
- ✅ Account detail modal (shows password, 2FA, devices)
- ✅ Host detail modal (shows devices)
- ❌ Device detail page route (not modal-based)
- ❌ History timeline display (data exists in backend, not shown in UI)

**UI/UX Enhancements:**
- ✅ Modal component system created
- ✅ Status badges with visual states
- ✅ Card-based layout for all entity lists
- ✅ Responsive mobile design
- ✅ Network access for multi-device usage
- ❌ Error toasts/notifications system
- ❌ Delete confirmations
- ❌ Loading states polish

## Next Steps (Finishing Phase 2 & Phase 3)

### Remaining Phase 2 Items
1. **History Timeline (PRIORITY)**
   - [ ] Fetch device history from backend (/api/devices/:id endpoint enhancement)
   - [ ] Create timeline component to display status changes
   - [ ] Display account assignment history
   - [ ] Display host deployment history
   - [ ] Show maintenance events in timeline

2. **Maintenance Events**
   - [ ] Create maintenance event form modal
   - [ ] Add "Log Maintenance" button to device detail view
   - [ ] Display maintenance log in device history

### Phase 3: Enhanced Features
1. **Search & Filters**
   - [ ] Search devices by serial, ID, or IP
   - [ ] Filter by status (deployed, standby, broken, testing)
   - [ ] Filter by host
   - [ ] Filter by account
   - [ ] Search accounts by Apple ID
   - [ ] Search hosts by name

2. **Polish & UX Improvements**
   - [ ] Toast notification system for success/error feedback
   - [ ] Delete confirmation modals
   - [ ] Loading skeleton states
   - [ ] Empty state illustrations
   - [ ] Pagination for large datasets
   - [ ] Sort functionality for lists

3. **Additional Features**
   - [ ] Export data to CSV
   - [ ] Bulk operations (assign multiple devices)
   - [ ] Device statistics and analytics
   - [ ] Quick filters in dashboard

## Implementation Timeline

- **Phase 1 (Foundation):** ✅ COMPLETE (2025-09-30) - Setup, database, basic CRUD, UI foundation
- **Phase 2 (Core Features):** 🚀 70% COMPLETE (2025-10-01) - Forms, operations, detail modals
- **Phase 3 (Polish):** 🎯 STARTING NOW - History timeline, search, filters, enhanced UX
- **Phase 4 (Testing):** Upcoming - Data migration, testing, deployment
- **Phase 5 (Future):** TBD - Health monitoring integration

## Decisions Made

1. **Authentication:** ✅ No authentication needed - closed network deployment, anyone with network access can use the app
2. **Deployment Environment:** ✅ Local deployment on specific macOS machine within closed network
3. **Device Numbering:** ✅ Using iOS Inspector's device numbers (1-63+), which serve as device_id field
   - Numbers 1-31: Mac Mini 1
   - Numbers 32+: Mac Mini 2
   - Future: Mac Mini 3 for additional devices
4. **Static IP Addresses:** ✅ Each device has a static IP - will be stored in device metadata
5. **Data Migration:** ✅ Will handle later via CSV import script using the REST API
6. **Health Monitoring API:** ✅ Argus will expose API endpoints that iOS Inspector processes can ping with their status

## Technical Debt & Future Considerations

- Health monitoring system (Phase 5)
- Push notifications for critical alerts
- Advanced analytics and reporting
- Automated backup system
- Multi-tenant support if needed for multiple teams
- Integration with iOS Inspector for automated status updates

## Resources & References

- **Prisma Docs:** https://www.prisma.io/docs
- **Vite PWA:** https://vite-pwa-org.netlify.app
- **shadcn/ui:** https://ui.shadcn.com
- **TanStack Query:** https://tanstack.com/query/latest

## Notes

- Project codename "Argus" chosen after the many-eyed giant from Greek mythology, fitting for a monitoring system
- PWA requirement driven by need for iPad usage in the device rack area
- History tracking is critical - this is the main improvement over Google Sheets
- System should scale to ~100-200 devices initially, but architecture supports much more
- Consider adding barcode/QR code scanning for quick device lookup on mobile