import {
  AFFECTED_REGIONS, BLOOD_GROUPS, CONDITIONS, CONTRAINDICATION_FLAGS, DURATION_UNITS, GENDERS, INDIAN_STATES,
  LANGUAGES, LIFESTYLES, MEDICAL_HISTORY, PATIENT_STATUS, PREVIOUS_TREATMENTS, REFERRAL_SOURCES, SLEEP_QUALITY,
} from '../enums.js';
import type { FormDefinition } from './types.js';

export const PATIENT_FORM: FormDefinition = {
  entity: 'patient',
  title: 'Patient registration',
  sections: [
    { id: 'identity', title: 'Identity', description: 'Mobile number is checked live for duplicates across all branches.' },
    { id: 'address', title: 'Address' },
    { id: 'intake', title: 'Acupuncture intake', description: 'Clinical intake captured at first consultation.' },
    { id: 'source', title: 'How did they find us?' },
    { id: 'consent', title: 'Consent & admin' },
  ],
  fields: [
    { key: 'pid', label: 'Patient ID', type: 'text', section: 'identity', computed: true, width: 'third', helpText: 'Auto-generated per branch' },
    { key: 'fullName', label: 'Full name', type: 'text', section: 'identity', required: true, width: 'third', placeholder: 'As on ID proof' },
    { key: 'mobile', label: 'Mobile number', type: 'mobile', section: 'identity', required: true, width: 'third', placeholder: '10-digit mobile' },
    { key: 'altMobile', label: 'Alternate mobile', type: 'mobile', section: 'identity', width: 'third' },
    { key: 'email', label: 'Email', type: 'email', section: 'identity', width: 'third' },
    { key: 'dateOfBirth', label: 'Date of birth', type: 'date', section: 'identity', width: 'third', helpText: 'Used for birthday greetings' },
    { key: 'gender', label: 'Gender', type: 'radio', section: 'identity', required: true, options: GENDERS, width: 'third' },
    { key: 'bloodGroup', label: 'Blood group', type: 'select', section: 'identity', options: BLOOD_GROUPS, width: 'third' },
    { key: 'photoUrl', label: 'Profile photo', type: 'photo', section: 'identity', width: 'third', helpText: 'Webcam capture or upload' },

    { key: 'addressLine', label: 'Address', type: 'text', section: 'address', width: 'full' },
    { key: 'area', label: 'Area / Locality', type: 'text', section: 'address', width: 'third' },
    { key: 'city', label: 'City', type: 'text', section: 'address', width: 'third' },
    { key: 'state', label: 'State', type: 'select', section: 'address', options: INDIAN_STATES, width: 'third', defaultValue: 'Tamil Nadu' },
    { key: 'pincode', label: 'PIN code', type: 'pincode', section: 'address', width: 'third' },

    { key: 'chiefComplaint', label: 'Chief complaint', type: 'textarea', section: 'intake', required: true, width: 'full', placeholder: 'e.g. Chronic lower back pain radiating to left leg' },
    { key: 'conditions', label: 'Presenting conditions', type: 'multiselect', section: 'intake', options: CONDITIONS, width: 'full', helpText: 'Drives treatment-plan reporting' },
    { key: 'complaintDurationValue', label: 'Duration', type: 'number', section: 'intake', width: 'quarter', min: 0 },
    { key: 'complaintDurationUnit', label: 'Duration unit', type: 'select', section: 'intake', options: DURATION_UNITS, width: 'quarter', defaultValue: 'months' },
    { key: 'painScale', label: 'Pain scale (0-10)', type: 'range', section: 'intake', min: 0, max: 10, step: 1, width: 'half', defaultValue: 5 },
    { key: 'affectedRegions', label: 'Affected regions', type: 'multiselect', section: 'intake', options: AFFECTED_REGIONS, width: 'full' },
    { key: 'diagnosisNotes', label: 'Diagnosis / assessment notes', type: 'textarea', section: 'intake', width: 'full' },
    { key: 'previousTreatments', label: 'Previous treatments tried', type: 'multiselect', section: 'intake', options: PREVIOUS_TREATMENTS, width: 'half' },
    { key: 'medicalHistory', label: 'Medical history', type: 'multiselect', section: 'intake', options: MEDICAL_HISTORY, width: 'half' },
    { key: 'currentMedications', label: 'Current medications', type: 'textarea', section: 'intake', width: 'half' },
    { key: 'allergies', label: 'Allergies', type: 'text', section: 'intake', width: 'half' },
    { key: 'contraindicationFlags', label: 'Contraindication flags', type: 'multiselect', section: 'intake', options: CONTRAINDICATION_FLAGS, width: 'full', helpText: 'Shown as a red banner on the patient record' },
    { key: 'lifestyle', label: 'Lifestyle', type: 'select', section: 'intake', options: LIFESTYLES, width: 'half' },
    { key: 'sleepQuality', label: 'Sleep quality', type: 'select', section: 'intake', options: SLEEP_QUALITY, width: 'half' },

    { key: 'referralSource', label: 'Referral source', type: 'select', section: 'source', required: true, options: REFERRAL_SOURCES, width: 'half', defaultValue: 'Walk-in' },
    { key: 'referredBy', label: 'Referred by', type: 'text', section: 'source', width: 'half', placeholder: 'Patient / doctor name', showIf: { key: 'referralSource', equals: ['Referral', 'Doctor referral'] } },

    { key: 'preferredLanguage', label: 'Preferred language', type: 'select', section: 'consent', options: LANGUAGES, width: 'third', defaultValue: 'Tamil' },
    { key: 'emergencyContactName', label: 'Emergency contact name', type: 'text', section: 'consent', width: 'third' },
    { key: 'emergencyContactMobile', label: 'Emergency contact mobile', type: 'mobile', section: 'consent', width: 'third' },
    { key: 'whatsappOptIn', label: 'Send WhatsApp reminders & greetings', type: 'checkbox', section: 'consent', width: 'half', defaultValue: true },
    { key: 'consentGiven', label: 'Treatment consent taken', type: 'checkbox', section: 'consent', required: true, width: 'half' },
    { key: 'status', label: 'Status', type: 'select', section: 'consent', options: PATIENT_STATUS, width: 'third', defaultValue: 'Active' },
    { key: 'tags', label: 'Tags', type: 'chips', section: 'consent', width: 'half', placeholder: 'VIP, Senior citizen…' },
    { key: 'notes', label: 'Notes', type: 'textarea', section: 'consent', width: 'full' },
  ],
};
