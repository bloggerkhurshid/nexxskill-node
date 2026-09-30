import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initDatabase } from './config/db.js';
import { startWebinarReminderScheduler } from './services/webinarReminderService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev, can restrict in prod
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-razorpay-signature']
  })
);

// Capture raw body for webhook verification
app.use(
  express.json({
    limit: '20mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static uploads serving
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Mount routes on both root and /v1 prefix for backwards & forwards compatibility
app.use('/v1', apiRouter);
app.use('/', apiRouter);

// 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server if run directly
async function startServer() {
  await initDatabase();
  startWebinarReminderScheduler();

  const server = app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 NexxSkill Node.js API Server`);
    console.log(`📡 Running on: http://localhost:${PORT}`);
    console.log(`🔗 API Base:   http://localhost:${PORT}/v1`);
    console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`===============================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use.`);
      console.error(`💡 Note: On macOS, Port 5000 is used by AirPlay Receiver.`);
      console.error(`👉 Try changing PORT to 5001 or 8080 in .env\n`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startServer().catch((err) => {
    console.error('Fatal Server Startup Error:', err);
  });
}

export { startServer };
export default app;
