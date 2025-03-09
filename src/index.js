import express, { json } from 'express';
import cors from "cors"
import adminRouter from './routes/admin.route.js';


const app = express();
app.use(json());
app.use(cors());
app.use('/api/admin', adminRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});