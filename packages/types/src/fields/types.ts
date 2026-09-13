/**
 * A FieldDescriptor is the single source of truth for one form field.
 * The web FormRenderer renders it, the API documents it, and the zod schema validates it.
 */
export type FieldType =
  | 'text' | 'textarea' | 'number' | 'money' | 'date' | 'datetime' | 'time' | 'month'
  | 'select' | 'multiselect' | 'chips' | 'checkbox' | 'radio' | 'range'
  | 'mobile' | 'email' | 'pincode'
  | 'patient' | 'staff' | 'doctor' | 'branch' | 'vendor' | 'package'
  | 'photo' | 'file';

export type FieldWidth = 'full' | 'half' | 'third' | 'two-thirds' | 'quarter';

export interface FieldOption { value: string; label: string }

export interface FieldDescriptor {
  key: string;
  label: string;
  type: FieldType;
  section: string;
  required?: boolean;
  options?: readonly string[] | readonly FieldOption[];
  placeholder?: string;
  helpText?: string;
  width?: FieldWidth;
  min?: number;
  max?: number;
  step?: number;
  /** show only when another field has a given value */
  showIf?: { key: string; equals: string | boolean | readonly string[] };
  /** read-only, computed by the server (rendered as info, never posted) */
  computed?: boolean;
  /** default value on new forms */
  defaultValue?: unknown;
}

export interface FormSection { id: string; title: string; description?: string }

export interface FormDefinition {
  entity: string;
  title: string;
  sections: FormSection[];
  fields: FieldDescriptor[];
}

export function fieldsBySection(def: FormDefinition): Array<{ section: FormSection; fields: FieldDescriptor[] }> {
  return def.sections.map((section) => ({
    section,
    fields: def.fields.filter((f) => f.section === section.id),
  }));
}

export function defaultValuesFor(def: FormDefinition): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (f.computed) continue;
    if (f.defaultValue !== undefined) out[f.key] = f.defaultValue;
    else if (f.type === 'multiselect' || f.type === 'chips') out[f.key] = [];
    else if (f.type === 'checkbox') out[f.key] = false;
    else out[f.key] = '';
  }
  return out;
}
