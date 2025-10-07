import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import deviceRoutes from './routes/devices';
import accountRoutes from './routes/accounts';
import hostRoutes from './routes/hosts';

dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors({
  origin: ['https://argus.local', 'https://api.argus.local', 'https://192.168.0.12', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } });
});

app.use('/api/devices', deviceRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/hosts', hostRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found', data: null });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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