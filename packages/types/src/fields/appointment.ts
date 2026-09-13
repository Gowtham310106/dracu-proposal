import { APPOINTMENT_STATUS, APPOINTMENT_TYPES } from '../enums.js';
import type { FormDefinition } from './types.js';

export const APPOINTMENT_FORM: FormDefinition = {
  entity: 'appointment',
  title: 'Book appointment',
  sections: [
    { id: 'booking', title: 'Booking' },
    { id: 'details', title: 'Details' },
  ],
  fields: [
    { key: 'branchId', label: 'Branch', type: 'branch', section: 'booking', required: true, width: 'third' },
    { key: 'patientId', label: 'Patient', type: 'patient', section: 'booking', required: true, width: 'third', helpText: 'Search by name, PID or mobile' },
    { key: 'doctorId', label: 'Doctor', type: 'doctor', section: 'booking', required: true, width: 'third' },
    { key: 'date', label: 'Date', type: 'date', section: 'booking', required: true, width: 'third' },
    { key: 'slotStart', label: 'Slot start', type: 'time', section: 'booking', required: true, width: 'third' },
    { key: 'slotEnd', label: 'Slot end', type: 'time', section: 'booking', required: true, width: 'third' },
    { key: 'type', label: 'Visit type', type: 'select', section: 'details', required: true, options: APPOINTMENT_TYPES, width: 'third', defaultValue: 'Consultation' },
    { key: 'treatmentPackageId', label: 'Treatment package', type: 'package', section: 'details', width: 'third', showIf: { key: 'type', equals: 'Session' }, helpText: 'Shows Session x / total on the queue' },
    { key: 'status', label: 'Status', type: 'select', section: 'details', options: APPOINTMENT_STATUS, width: 'third', defaultValue: 'Booked' },
    { key: 'reason', label: 'Reason for visit', type: 'text', section: 'details', width: 'half' },
    { key: 'notes', label: 'Notes', type: 'textarea', section: 'details', width: 'half' },
  ],
};
