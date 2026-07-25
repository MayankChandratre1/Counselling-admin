import express, { json } from 'express';
import cors from "cors"
import compression from 'compression';
import connectDB from './config/database.js';

// New Modular Routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import contentRoutes from './routes/content.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import listRoutes from './routes/list.routes.js';
import formRoutes from './routes/form.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import adminRoutes from './routes/admin.routes.js';

// Legacy Routes (Keep for backward compatibility during transition if needed)
// import adminRouter from './routes/admin.route.js'; 
import collegeRouter from './routes/college.routes.js';
import razRouter from './routes/raz.routes.js';

import errorHandler from './middleware/errorHandler.js';
import authMiddleware from './middleware/authMiddleware.js';
import logActivity from './middleware/logActivityMiddleware.js';

// Connect to MongoDB (await so pool is ready before accepting traffic)
await connectDB();

const app = express();
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === '1' || trustProxy === 'true' || trustProxy === 'yes') {
    app.set('trust proxy', 1);
}
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} ${new Date().toLocaleString()}`);
  next();
});

// Mount Routes — auth + activity log once (was mounted per-router → N duplicate logs per request)
app.use('/api/admin', authRoutes);

const protectedAdmin = express.Router();
protectedAdmin.use(authMiddleware);
protectedAdmin.use(logActivity);
protectedAdmin.use(userRoutes);
protectedAdmin.use(analyticsRoutes);
protectedAdmin.use(contentRoutes);
protectedAdmin.use(paymentRoutes);
protectedAdmin.use(listRoutes);
protectedAdmin.use(formRoutes);
protectedAdmin.use(appointmentRoutes);
protectedAdmin.use(notificationRoutes);
protectedAdmin.use(adminRoutes);
app.use('/api/admin', protectedAdmin);

// Other Routes
app.use('/api/colleges', collegeRouter);
app.use('/api/razorpay', razRouter);

// Error Handler
app.use(errorHandler);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    message: `Cannot ${req.method} ${req.url}`,
    hint: "Check API route or restart server."
  });
});

const PORT = process.env.PORT || 3008;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/admin`);
});