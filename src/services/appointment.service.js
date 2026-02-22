import { Appointment } from '../models/misc.model.js';

class AppointmentService {
    /**
     * Get all appointments, optionally filtered.
     * Mirrors admin.service.js getAppointments (lines 2531–2574)
     */
    async getAppointments(filters = null) {
        try {
            const query = {};

            if (filters) {
                if (filters.fromDate) {
                    query.createdAt = query.createdAt || {};
                    query.createdAt.$gte = new Date(new Date(filters.fromDate).setHours(0, 0, 0, 0));
                }
                if (filters.toDate) {
                    query.createdAt = query.createdAt || {};
                    query.createdAt.$lte = new Date(new Date(filters.toDate).setHours(23, 59, 59, 999));
                }
                if (filters.status) query.status = filters.status;
                if (filters.phone) query.phone = filters.phone;
            }

            return await Appointment.find(query).sort({ createdAt: -1 }).lean();
        } catch (error) {
            throw new Error('Failed to get appointments: ' + error.message);
        }
    }

    /**
     * Update an appointment by its string `id` field.
     * Mirrors admin.service.js editAppointment (lines 2576–2597)
     */
    async editAppointment(appointmentId, appointmentData) {
        try {
            const updated = await Appointment.findOneAndUpdate(
                { id: appointmentId },
                { $set: { ...appointmentData, updatedAt: new Date() } },
                { new: true }
            );
            if (!updated) throw new Error('Appointment not found');

            return {
                message: 'Appointment updated successfully',
                appointment: updated
            };
        } catch (error) {
            throw new Error('Failed to update appointment: ' + error.message);
        }
    }

    /**
     * Create a new appointment.
     */
    async createAppointment(data) {
        try {
            const id = 'appt_' + Date.now();
            const appointment = new Appointment({ ...data, id });
            await appointment.save();
            return appointment;
        } catch (error) {
            throw new Error('Failed to create appointment: ' + error.message);
        }
    }

    /**
     * Delete an appointment by its string `id` field.
     */
    async deleteAppointment(appointmentId) {
        try {
            const result = await Appointment.deleteOne({ id: appointmentId });
            if (result.deletedCount === 0) throw new Error('Appointment not found');
            return { message: 'Appointment deleted successfully' };
        } catch (error) {
            throw new Error('Failed to delete appointment: ' + error.message);
        }
    }
}

export default new AppointmentService();
