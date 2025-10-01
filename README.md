# Argus - iOS Device Fleet Management System

Argus is a comprehensive fleet management system for tracking iOS devices (iPhones/iPads) used in the iOS Inspector project. It provides a web-based interface to manage devices, Apple ID accounts, deployment hosts, and maintain complete historical records.

## Features

- **Device Management**: Track iPhones and iPads with unique identifiers, models, iOS versions, and static IPs
- **Account Management**: Manage Apple ID accounts and their assignments to devices
- **Host Management**: Monitor Mac Mini hosts running iOS Inspector
- **Complete History**: Track all status changes, account assignments, host deployments, and maintenance events
- **Progressive Web App**: Installable on desktop and iPad with offline capabilities
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## Tech Stack

### Backend
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL 15

### Frontend
- React 18 + TypeScript
- Vite
- TanStack Query (React Query)
- React Router v6
- Vite PWA Plugin

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (for PostgreSQL)
- npm or yarn

## Getting Started

### 1. Clone the Repository

```bash
cd /Users/xmedavid/dev/argus
```

### 2. Start the Database

```bash
docker-compose up -d
```

This will start a PostgreSQL database on port 5432.

### 3. Set Up the Backend

```bash
cd backend

# Install dependencies
npm install

# Run database migrations
npm run prisma:migrate

# Start the development server
npm run dev
```

The backend API will be available at `http://localhost:3000`

### 4. Set Up the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

## API Endpoints

### Devices
- `GET /api/devices` - List all devices
- `GET /api/devices/:id` - Get device details
- `POST /api/devices` - Create new device
- `PATCH /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device
- `GET /api/devices/:id/history` - Get device history
- `POST /api/devices/:id/assign-account` - Assign account to device
- `POST /api/devices/:id/assign-host` - Deploy device to host
- `POST /api/devices/:id/change-status` - Change device status
- `POST /api/devices/:id/maintenance` - Log maintenance event

### Accounts
- `GET /api/accounts` - List all accounts
- `GET /api/accounts/:id` - Get account details
- `POST /api/accounts` - Create new account
- `PATCH /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

### Hosts
- `GET /api/hosts` - List all hosts
- `GET /api/hosts/:id` - Get host details
- `POST /api/hosts` - Create new host
- `PATCH /api/hosts/:id` - Update host
- `DELETE /api/hosts/:id` - Delete host
- `GET /api/hosts/:id/devices` - Get devices on host

## Database Schema

The system uses the following main entities:

- **devices**: Core device information (iPhone/iPad)
- **accounts**: Apple ID accounts
- **hosts**: Mac Mini hosts running iOS Inspector
- **device_status_history**: Historical record of status changes
- **device_account_history**: Historical record of account assignments
- **device_host_history**: Historical record of host deployments
- **maintenance_events**: Maintenance activities (battery replacement, repairs, etc.)
- **health_checks**: Future feature for device health monitoring

## Development Scripts

### Backend
```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm run start        # Start production server
npm run prisma:migrate  # Run database migrations
npm run prisma:studio   # Open Prisma Studio (database GUI)
```

### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

## Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://argus:argus_dev_password@localhost:5432/argus?schema=public"
PORT=3000
NODE_ENV=development
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000
```

## Production Deployment

1. Build the backend:
```bash
cd backend
npm run build
```

2. Build the frontend:
```bash
cd frontend
npm run build
```

3. Deploy the `backend/dist` and `frontend/dist` directories to your macOS server
4. Update environment variables for production
5. Set up PostgreSQL in production
6. Run migrations: `npm run prisma:migrate`
7. Start the backend: `npm start`
8. Serve the frontend using nginx or similar

## Project Structure

```
argus/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   ├── src/
│   │   ├── controllers/           # Request handlers
│   │   ├── routes/                # API routes
│   │   ├── utils/                 # Utilities (Prisma client, response helpers)
│   │   └── index.ts               # Express app entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   └── api.ts             # API client and types
│   │   ├── pages/                 # React pages
│   │   ├── App.tsx                # Main app component
│   │   └── main.tsx               # Entry point
│   ├── vite.config.ts             # Vite + PWA configuration
│   └── package.json
├── docker-compose.yml             # PostgreSQL setup
├── PROJECT_PLAN.md                # Technical specification
├── CLAUDE.md                      # Project state tracker
└── README.md                      # This file
```

## Data Migration

To import existing data from Google Sheets:

1. Export your Google Sheets to CSV
2. Create a migration script using the REST API
3. POST data to the appropriate endpoints

Example script structure:
```typescript
import { deviceApi } from './frontend/src/lib/api';

const csvData = readCSV('devices.csv');
for (const row of csvData) {
  await deviceApi.create({
    internalSerial: row.serial,
    deviceId: parseInt(row.id),
    deviceType: row.type,
    // ... other fields
  });
}
```

## Future Enhancements

- [ ] Health check system with alerting
- [ ] Automated device provisioning workflows
- [ ] Analytics and reporting dashboard
- [ ] Export functionality (CSV, PDF reports)
- [ ] Multi-user support with permissions
- [ ] Audit logs for all changes
- [ ] QR code scanning for quick device lookup

## Troubleshooting

### Database connection issues
- Ensure Docker is running: `docker ps`
- Check if PostgreSQL is healthy: `docker-compose logs postgres`
- Verify DATABASE_URL in backend/.env matches docker-compose.yml

### Frontend can't connect to backend
- Ensure backend is running on port 3000
- Check VITE_API_URL in frontend/.env
- Verify CORS is configured correctly in backend

### Prisma migration errors
- Reset database: `npm run prisma:migrate reset`
- Regenerate client: `npm run prisma:generate`

## License

ISC

## Support

For issues or questions, contact the development team or create an issue in the project repository.