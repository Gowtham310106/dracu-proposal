import { FOLLOW_UP_CHANNELS, LEAD_SOURCES, LEAD_STATUS, TREATMENT_PRESETS } from '../enums.js';
import type { FormDefinition } from './types.js';

export const LEAD_FORM: FormDefinition = {
  entity: 'lead',
  title: 'New enquiry',
  sections: [
    { id: 'contact', title: 'Contact' },
    { id: 'enquiry', title: 'Enquiry' },
    { id: 'pipeline', title: 'Pipeline' },
  ],
  fields: [
    { key: 'leadNo', label: 'Lead no.', type: 'text', section: 'contact', computed: true, width: 'third' },
    { key: 'name', label: 'Name', type: 'text', section: 'contact', required: true, width: 'third' },
    { key: 'mobile', label: 'Mobile', type: 'mobile', section: 'contact', required: true, width: 'third', helpText: 'Checked against existing leads and patients' },
    { key: 'branchId', label: 'Branch', type: 'branch', section: 'contact', required: true, width: 'third' },
    { key: 'source', label: 'Source', type: 'select', section: 'contact', required: true, options: LEAD_SOURCES, width: 'third', defaultValue: 'Instagram' },
    { key: 'campaign', label: 'Campaign / Ad name', type: 'text', section: 'contact', width: 'third', showIf: { key: 'source', equals: ['Ads', 'Instagram', 'Google'] } },

    { key: 'interestedIn', label: 'Interested in', type: 'select', section: 'enquiry', options: TREATMENT_PRESETS, width: 'half' },
    { key: 'complaintSummary', label: 'Complaint summary', type: 'textarea', section: 'enquiry', width: 'full' },

    { key: 'status', label: 'Status', type: 'select', section: 'pipeline', required: true, options: LEAD_STATUS, width: 'third', defaultValue: 'New' },
    { key: 'assignedTo', label: 'Assigned to', type: 'staff', section: 'pipeline', width: 'third' },
    { key: 'nextFollowUpAt', label: 'Next follow-up', type: 'datetime', section: 'pipeline', width: 'third' },
    { key: 'lostReason', label: 'Lost reason', type: 'text', section: 'pipeline', width: 'full', showIf: { key: 'status', equals: 'Lost' } },
  ],
};

export const FOLLOW_UP_FORM: FormDefinition = {
  entity: 'followUp',
  title: 'Add follow-up',
  sections: [{ id: 'f', title: 'Follow-up' }],
  fields: [
    { key: 'channel', label: 'Channel', type: 'select', section: 'f', required: true, options: FOLLOW_UP_CHANNELS, width: 'third', defaultValue: 'Call' },
    { key: 'outcome', label: 'Outcome', type: 'text', section: 'f', required: true, width: 'two-thirds', placeholder: 'e.g. Will visit Saturday' },
    { key: 'note', label: 'Note', type: 'textarea', section: 'f', width: 'full' },
    { key: 'nextFollowUpAt', label: 'Schedule next follow-up', type: 'datetime', section: 'f', width: 'half' },
    { key: 'status', label: 'Move status to', type: 'select', section: 'f', options: LEAD_STATUS, width: 'half' },
  ],
};
