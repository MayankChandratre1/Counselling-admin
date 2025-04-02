import express, { json } from 'express';
import cors from "cors"
import adminRouter from './routes/admin.route.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();
app.use(json());
app.use(cors());

// Add a simple logging middleware for debugging routes
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} ${new Date().toISOString()}`);
  next();
});

app.use('/api/admin', adminRouter);

// Add error handler middleware
app.use(errorHandler);

// 404 handler - must be before the error handler
app.use((req, res) => {
  res.status(404).json({ 
    message: `Cannot ${req.method} ${req.url}`,
    hint: "Try restarting the server to load updated routes."
  });
});

const PORT = process.env.PORT || 3008;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/admin`);
});