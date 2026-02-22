import express from 'express';
import AppointmentController from '../controllers/appointment.controller.js';

const router = express.Router();

router.get('/get-appointments', AppointmentController.getAppointments);
router.put('/edit-appointment/:id', AppointmentController.editAppointment);

export default router;
