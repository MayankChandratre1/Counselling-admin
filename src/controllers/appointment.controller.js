import AppointmentService from '../services/appointment.service.js';

const AppointmentController = {
    async getAppointments(req, res) {
        try {
            const result = await AppointmentService.getAppointments(req.query);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async editAppointment(req, res) {
        try {
            const result = await AppointmentService.editAppointment(req.params.id, req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

export default AppointmentController;
