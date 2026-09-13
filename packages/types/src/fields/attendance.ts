import { ATTENDANCE_STATUS } from '../enums.js';
import type { FormDefinition } from './types.js';

export const ATTENDANCE_FORM: FormDefinition = {
  entity: 'attendance',
  title: 'Manual attendance entry',
  sections: [{ id: 'a', title: 'Attendance' }],
  fields: [
    { key: 'staffId', label: 'Staff', type: 'staff', section: 'a', required: true, width: 'third' },
    { key: 'branchId', label: 'Branch', type: 'branch', section: 'a', required: true, width: 'third' },
    { key: 'date', label: 'Date', type: 'date', section: 'a', required: true, width: 'third' },
    { key: 'checkIn', label: 'Check-in', type: 'time', section: 'a', width: 'third' },
    { key: 'checkOut', label: 'Check-out', type: 'time', section: 'a', width: 'third' },
    { key: 'status', label: 'Status', type: 'select', section: 'a', required: true, options: ATTENDANCE_STATUS, width: 'third', defaultValue: 'Present' },
    { key: 'remarks', label: 'Remarks', type: 'text', section: 'a', width: 'full' },
  ],
};

/** Columns accepted by the CSV importer (header row, case-insensitive). */
export const ATTENDANCE_CSV_COLUMNS = ['deviceUserId', 'timestamp', 'branchCode', 'direction'] as const;
