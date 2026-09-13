import { MEDIA_CATEGORIES, MEDIA_KINDS } from '../enums.js';
import type { FormDefinition } from './types.js';

export const MEDIA_LIMITS = {
  videoMaxBytes: 15 * 1024 * 1024,
  photoMaxBytes: 5 * 1024 * 1024,
  videoMimes: ['video/mp4', 'video/webm', 'video/quicktime'],
  photoMimes: ['image/jpeg', 'image/png', 'image/webp'],
  documentMimes: ['application/pdf'],
} as const;

export const MEDIA_FORM: FormDefinition = {
  entity: 'media',
  title: 'Upload media',
  sections: [{ id: 'm', title: 'Media' }],
  fields: [
    { key: 'patientId', label: 'Patient', type: 'patient', section: 'm', required: true, width: 'half' },
    { key: 'kind', label: 'Kind', type: 'radio', section: 'm', required: true, options: MEDIA_KINDS, width: 'quarter', defaultValue: 'Video' },
    { key: 'category', label: 'Category', type: 'select', section: 'm', required: true, options: MEDIA_CATEGORIES, width: 'quarter', defaultValue: 'Progress' },
    { key: 'title', label: 'Title', type: 'text', section: 'm', width: 'half', placeholder: 'Session 5 – knee flexion' },
    { key: 'capturedAt', label: 'Captured on', type: 'date', section: 'm', width: 'half' },
    { key: 'notes', label: 'Notes', type: 'textarea', section: 'm', width: 'full' },
  ],
};
