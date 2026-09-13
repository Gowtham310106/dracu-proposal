import { PATIENT_RESPONSE, TECHNIQUES } from '../enums.js';
import type { FormDefinition } from './types.js';

/** Bedside form used by doctors on tablet / mobile after each acupuncture session. */
export const SESSION_LOG_FORM: FormDefinition = {
  entity: 'sessionLog',
  title: 'Log session',
  sections: [
    { id: 'session', title: 'Session' },
    { id: 'clinical', title: 'Clinical notes' },
    { id: 'outcome', title: 'Outcome' },
  ],
  fields: [
    { key: 'sessionNumber', label: 'Session no.', type: 'number', section: 'session', computed: true, width: 'quarter' },
    { key: 'date', label: 'Date', type: 'date', section: 'session', required: true, width: 'quarter' },
    { key: 'doctorId', label: 'Doctor', type: 'doctor', section: 'session', required: true, width: 'half' },
    { key: 'painScaleBefore', label: 'Pain before (0-10)', type: 'range', section: 'session', min: 0, max: 10, step: 1, width: 'half' },
    { key: 'painScaleAfter', label: 'Pain after (0-10)', type: 'range', section: 'session', min: 0, max: 10, step: 1, width: 'half' },

    { key: 'technique', label: 'Technique', type: 'multiselect', section: 'clinical', options: TECHNIQUES, width: 'full', defaultValue: ['Needling'] },
    { key: 'pointsUsed', label: 'Points used', type: 'chips', section: 'clinical', width: 'half', placeholder: 'LI4, ST36, BL23…', helpText: 'Type a point and press Enter' },
    { key: 'needleRetentionMinutes', label: 'Needle retention (min)', type: 'number', section: 'clinical', min: 0, max: 120, width: 'quarter', defaultValue: 20 },
    { key: 'observations', label: 'Observations', type: 'textarea', section: 'clinical', required: true, width: 'full' },

    { key: 'patientResponse', label: 'Patient response', type: 'radio', section: 'outcome', options: PATIENT_RESPONSE, width: 'third', defaultValue: 'Improved' },
    { key: 'adverseEvents', label: 'Adverse events', type: 'text', section: 'outcome', width: 'two-thirds', placeholder: 'None' },
    { key: 'nextSessionAdvice', label: 'Advice for next session', type: 'textarea', section: 'outcome', width: 'full' },
  ],
};
