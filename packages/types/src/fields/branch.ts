import { INDIAN_STATES, WEEK_DAYS } from '../enums.js';
import type { FormDefinition } from './types.js';

export const BRANCH_FORM: FormDefinition = {
  entity: 'branch',
  title: 'Branch',
  sections: [
    { id: 'b', title: 'Branch identity' },
    { id: 'hours', title: 'Working hours & slots' },
  ],
  fields: [
    { key: 'code', label: 'Branch code', type: 'text', section: 'b', required: true, width: 'quarter', placeholder: 'CBE', helpText: '2–4 letters, used in PID and invoice numbers' },
    { key: 'name', label: 'Branch name', type: 'text', section: 'b', required: true, width: 'two-thirds' },
    { key: 'phone', label: 'Phone', type: 'mobile', section: 'b', required: true, width: 'third' },
    { key: 'whatsappNumber', label: 'WhatsApp number', type: 'mobile', section: 'b', width: 'third' },
    { key: 'gstin', label: 'GSTIN', type: 'text', section: 'b', width: 'third' },
    { key: 'address', label: 'Address', type: 'text', section: 'b', width: 'two-thirds' },
    { key: 'city', label: 'City', type: 'text', section: 'b', width: 'third' },
    { key: 'state', label: 'State', type: 'select', section: 'b', options: INDIAN_STATES, width: 'third', defaultValue: 'Tamil Nadu' },
    { key: 'active', label: 'Active', type: 'checkbox', section: 'b', width: 'third', defaultValue: true },

    { key: 'workingDays', label: 'Working days', type: 'multiselect', section: 'hours', options: WEEK_DAYS, width: 'full', defaultValue: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
    { key: 'workingHours.open', label: 'Opens at', type: 'time', section: 'hours', width: 'quarter', defaultValue: '09:00' },
    { key: 'workingHours.close', label: 'Closes at', type: 'time', section: 'hours', width: 'quarter', defaultValue: '20:00' },
    { key: 'slotDurationMinutes', label: 'Slot duration (min)', type: 'number', section: 'hours', min: 10, max: 120, step: 5, width: 'quarter', defaultValue: 30 },
    { key: 'reminderHour', label: 'Reminder send hour', type: 'number', section: 'hours', min: 0, max: 23, width: 'quarter', defaultValue: 18, helpText: 'Hour (24h) at which day-before reminders go out' },
  ],
};
