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

// Legacy Routes (Keep for backward compatibility during transition if needed)
// import adminRouter from './routes/admin.route.js'; 
import collegeRouter from './routes/college.routes.js';
import razRouter from './routes/raz.routes.js';

import errorHandler from './middleware/errorHandler.js';

// Connect to MongoDB
connectDB();

const app = express();
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} ${new Date().toLocaleString()}`);
  next();
});

// Mount Routes
app.use('/api/admin', authRoutes);
app.use('/api/admin', userRoutes);
app.use('/api/admin', analyticsRoutes);
app.use('/api/admin', contentRoutes);
app.use('/api/admin', paymentRoutes);
app.use('/api/admin', listRoutes);
app.use('/api/admin', formRoutes);
app.use('/api/admin', appointmentRoutes);
app.use('/api/admin', notificationRoutes);

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