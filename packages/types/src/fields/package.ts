import { PACKAGE_STATUS, PRICING_MODES, SESSION_FREQUENCY, TREATMENT_PRESETS } from '../enums.js';
import type { FormDefinition } from './types.js';

export const PACKAGE_FORM: FormDefinition = {
  entity: 'treatmentPackage',
  title: 'Treatment package',
  sections: [
    { id: 'plan', title: 'Treatment plan' },
    { id: 'fees', title: 'Fees', description: 'Total payable, paid and balance are computed by the server from payments.' },
    { id: 'status', title: 'Status' },
  ],
  fields: [
    { key: 'packageNo', label: 'Package no.', type: 'text', section: 'plan', computed: true, width: 'third' },
    { key: 'patientId', label: 'Patient', type: 'patient', section: 'plan', required: true, width: 'third' },
    { key: 'branchId', label: 'Branch', type: 'branch', section: 'plan', required: true, width: 'third' },
    { key: 'treatmentPlanName', label: 'Treatment plan', type: 'select', section: 'plan', required: true, options: TREATMENT_PRESETS, width: 'third' },
    { key: 'customPlanName', label: 'Custom plan name', type: 'text', section: 'plan', width: 'third', showIf: { key: 'treatmentPlanName', equals: 'Custom' } },
    { key: 'assignedDoctorId', label: 'Assigned doctor', type: 'doctor', section: 'plan', width: 'third' },
    { key: 'totalSessions', label: 'Total sessions', type: 'number', section: 'plan', required: true, min: 1, max: 200, width: 'third', defaultValue: 10 },
    { key: 'sessionFrequency', label: 'Session frequency', type: 'select', section: 'plan', options: SESSION_FREQUENCY, width: 'third', defaultValue: 'Alternate days' },
    { key: 'startDate', label: 'Start date', type: 'date', section: 'plan', required: true, width: 'third' },
    { key: 'expectedEndDate', label: 'Expected end date', type: 'date', section: 'plan', width: 'third', helpText: 'Auto-suggested from frequency, editable' },

    { key: 'pricingMode', label: 'Pricing mode', type: 'radio', section: 'fees', required: true, options: PRICING_MODES, width: 'third', defaultValue: 'Package' },
    { key: 'perSessionFee', label: 'Fee per session (₹)', type: 'money', section: 'fees', width: 'third', min: 0, showIf: { key: 'pricingMode', equals: 'Per-session' } },
    { key: 'packageFee', label: 'Package fee (₹)', type: 'money', section: 'fees', width: 'third', min: 0, showIf: { key: 'pricingMode', equals: 'Package' } },
    { key: 'discount', label: 'Discount (₹)', type: 'money', section: 'fees', width: 'third', min: 0, defaultValue: 0 },
    { key: 'totalPayable', label: 'Total payable (₹)', type: 'money', section: 'fees', computed: true, width: 'third' },
    { key: 'balance', label: 'Balance (₹)', type: 'money', section: 'fees', computed: true, width: 'third' },

    { key: 'status', label: 'Status', type: 'select', section: 'status', options: PACKAGE_STATUS, width: 'third', defaultValue: 'Active' },
    { key: 'discontinueReason', label: 'Discontinue reason', type: 'text', section: 'status', width: 'half', showIf: { key: 'status', equals: 'Discontinued' } },
    { key: 'notes', label: 'Notes', type: 'textarea', section: 'status', width: 'full' },
  ],
};
