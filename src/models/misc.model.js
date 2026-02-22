import mongoose from 'mongoose';
import {
    AppointmentSchema,
    CancellationSchema,
    CollegeUpdateSchema,
    DowntimePaymentSchema,
    ListFolderSchema,
    DynamicScreenSchema,
    PermissionSchema
} from '../../scripts/SchemasV3.js';

export const Appointment = mongoose.models.Appointment
    || mongoose.model('Appointment', AppointmentSchema, 'appointments');

export const Cancellation = mongoose.models.Cancellation
    || mongoose.model('Cancellation', CancellationSchema, 'cancellations');

export const CollegeUpdate = mongoose.models.CollegeUpdate
    || mongoose.model('CollegeUpdate', CollegeUpdateSchema, 'college_updates');

export const DowntimePayment = mongoose.models.DowntimePayment
    || mongoose.model('DowntimePayment', DowntimePaymentSchema, 'downtimePayments');

export const ListFolder = mongoose.models.ListFolder
    || mongoose.model('ListFolder', ListFolderSchema, 'list_folders');

export const DynamicScreen = mongoose.models.DynamicScreen
    || mongoose.model('DynamicScreen', DynamicScreenSchema, 'dynamicScreens');

export const Permission = mongoose.models.Permission
    || mongoose.model('Permission', PermissionSchema, 'permissions');
