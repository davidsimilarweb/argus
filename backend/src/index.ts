import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import deviceRoutes from './routes/devices';
import accountRoutes from './routes/accounts';
import hostRoutes from './routes/hosts';
import settingsRoutes from './routes/settings';
import slotRoutes from './routes/slots';
import networkRoutes from './routes/network';
import { getHealthSummary } from './controllers/health';

dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
const parseOrigins = () => {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) return ['http://localhost:5173', 'https://argus.lan', 'https://api.argus.lan'];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
};
app.use(cors({
  origin: parseOrigins(),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (LOG_LEVEL === 'debug' || LOG_LEVEL === 'info') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  }
  next();
});

// Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } });
});

app.use('/api/devices', deviceRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/hosts', hostRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/network', networkRoutes);

app.get('/api/health/summary', getHealthSummary);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found', data: null });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    data: null
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Argus API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Network access: Backend listening on all interfaces (0.0.0.0:${PORT})`);
});
