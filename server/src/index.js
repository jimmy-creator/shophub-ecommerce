import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import sequelize from './config/database.js';
import { User, Product, Order } from './models/index.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import uploadRoutes from './routes/upload.js';
import paymentRoutes from './routes/payment.js';
import couponRoutes from './routes/coupons.js';
import reviewRoutes from './routes/reviews.js';
import analyticsRoutes from './routes/analytics.js';
import settingsRoutes from './routes/settings.js';
import customerRoutes from './routes/customers.js';
import categoryRoutes from './routes/categories.js';
import bulkProductRoutes from './routes/bulkProducts.js';
import cancellationRoutes from './routes/cancellation.js';
import staffRoutes from './routes/staff.js';
import googleAuthRoutes from './routes/googleAuth.js';
import pincodeRoutes from './routes/pincodes.js';
import abandonedCartRoutes from './routes/abandonedCart.js';
import { startAbandonedCartJob } from './services/abandonedCartJob.js';
import { startLowStockJob } from './services/lowStockJob.js';
import sitemapRoutes from './routes/sitemap.js';
import { sanitizeInput, preventInjection, forceHttps } from './middleware/security.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Force HTTPS in production
app.use(forceHttps);

// Trust proxy (for Hostinger/Nginx)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL || true
    : process.env.CLIENT_URL,
  credentials: true,
}));

// Prevent HTTP parameter pollution
app.use(hpp());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing with size limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Input sanitization (XSS + injection prevention)
app.use(sanitizeInput);
app.use(preventInjection);

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/bulk-products', bulkProductRoutes);
app.use('/api/orders', cancellationRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/auth', googleAuthRoutes);
app.use('/api/pincodes', pincodeRoutes);
app.use('/api/abandoned-cart', abandonedCartRoutes);
app.use('/', sitemapRoutes);

// Frontend is served by Nginx in production
// In development, Vite dev server handles it

// Error handler — never leak stack traces in production
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  const status = err.status || 500;
  res.status(status).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Something went wrong'
      : err.message,
  });
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected');
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Models synced');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startAbandonedCartJob();
      startLowStockJob();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
