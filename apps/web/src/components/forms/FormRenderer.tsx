'use client';

import { useMemo } from 'react';
import { Controller, type Control, type FieldErrors, type UseFormWatch } from 'react-hook-form';
import { fieldsBySection, type FieldDescriptor, type FieldOption, type FormDefinition } from '@acuheal/types';
import { ChipsInput, Field, Input, MultiSelect, Select, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';

const WIDTHS: Record<string, string> = {
  full: 'md:col-span-12',
  half: 'md:col-span-6',
  third: 'md:col-span-4',
  'two-thirds': 'md:col-span-8',
  quarter: 'md:col-span-3',
};

function toOptions(options?: readonly string[] | readonly FieldOption[]): FieldOption[] {
  if (!options) return [];
  return (options as readonly (string | FieldOption)[]).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}

/** Reads a possibly dotted key (e.g. "salary.basic") out of a form values object. */
function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], obj);
}

function errorFor(errors: FieldErrors, key: string): string | undefined {
  const node = getPath(errors, key) as { message?: string } | undefined;
  return typeof node?.message === 'string' ? node.message : undefined;
}

export interface FormRendererProps {
  definition: FormDefinition;
  control: Control<Record<string, unknown>>;
  errors: FieldErrors;
  watch: UseFormWatch<Record<string, unknown>>;
  /** Custom renderers for reference field types (patient, doctor, branch…) keyed by field key or type. */
  slots?: Record<string, (field: FieldDescriptor) => React.ReactNode>;
  /** Values for computed/read-only fields, keyed by field key. */
  computedValues?: Record<string, React.ReactNode>;
  /** Field keys to hide entirely (e.g. branch when it is implied by scope). */
  hidden?: string[];
  /** Render only these sections. */
  onlySections?: string[];
  disabled?: boolean;
}

export function FormRenderer({ definition, control, errors, watch, slots = {}, computedValues = {}, hidden = [], onlySections, disabled }: FormRendererProps) {
  const grouped = useMemo(() => fieldsBySection(definition).filter((g) => (onlySections ? onlySections.includes(g.section.id) : true)), [definition, onlySections]);
  const values = watch();

  const visible = (f: FieldDescriptor): boolean => {
    if (hidden.includes(f.key)) return false;
    if (!f.showIf) return true;
    const current = getPath(values, f.showIf.key);
    const expected = f.showIf.equals;
    return Array.isArray(expected) ? (expected as readonly string[]).includes(String(current)) : current === expected;
  };

  return (
    <div className="space-y-5">
      {grouped.map(({ section, fields }) => {
        const shown = fields.filter(visible);
        if (!shown.length) return null;
        return (
          <section key={section.id} className="card overflow-hidden">
            <header className="border-b border-line bg-gray-50/60 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
              {section.description && <p className="mt-0.5 text-xs text-muted">{section.description}</p>}
            </header>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 p-4 md:grid-cols-12">
              {shown.map((f) => (
                <div key={f.key} className={cn('md:col-span-12', WIDTHS[f.width ?? 'half'])}>
                  <FieldControl field={f} control={control} errors={errors} slots={slots} computedValues={computedValues} disabled={disabled} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FieldControl({ field: f, control, errors, slots, computedValues, disabled }: { field: FieldDescriptor; control: Control<Record<string, unknown>>; errors: FieldErrors; slots: NonNullable<FormRendererProps['slots']>; computedValues: NonNullable<FormRendererProps['computedValues']>; disabled?: boolean }) {
  const error = errorFor(errors, f.key);
  const options = toOptions(f.options);
  const slot = slots[f.key] ?? slots[f.type];

  if (f.computed) {
    return (
      <Field label={f.label} help={f.helpText}>
        <div className="inp flex items-center bg-gray-50 text-sm font-semibold text-gray-600">{computedValues[f.key] ?? <span className="text-muted">Auto-generated</span>}</div>
      </Field>
    );
  }

  if (slot) {
    return (
      <Field label={f.label} required={f.required} error={error} help={f.helpText}>
        {slot(f)}
      </Field>
    );
  }

  return (
    <Controller
      name={f.key}
      control={control}
      render={({ field }) => {
        const common = { id: f.key, disabled, 'aria-invalid': error ? true : undefined } as const;
        switch (f.type) {
          case 'textarea':
            return (
              <Field label={f.label} required={f.required} error={error} help={f.helpText}>
                <Textarea {...common} placeholder={f.placeholder} value={(field.value as string) ?? ''} onChange={field.onChange} onBlur={field.onBlur} />
              </Field>
            );

          case 'select':
            return (
              <Field label={f.label} required={f.required} error={error} help={f.helpText}>
                <Select {...common} value={(field.value as string) ?? ''} onChange={field.onChange} onBlur={field.onBlur}>
                  <option value="">{f.placeholder ?? 'Select…'}</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            );

          case 'radio':
            return (
              <Field label={f.label} required={f.required} error={error} help={f.helpText}>
                <div className="flex flex-wrap gap-1.5">
                  {options.map((o) => (
                    <button key={o.value} type="button" disabled={disabled} onClick={() => field.onChange(o.value)} className={cn('rounded-lg border px-3 py-1.5 text-sm font-medium transition', field.value === o.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-gray-700 hover:border-brand-300')}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </Field>
            );

          case 'multiselect':
            return (
              <Field label={f.label} required={f.required} error={error} help={f.helpText}>
                <MultiSelect options={options} value={(field.value as string[]) ?? []} onChange={field.onChange} />
              </Field>
            );

          case 'chips':
            return (
              <Field label={f.label} required={f.required} error={error} help={f.helpText}>
                <ChipsInput id={f.key} value={(field.value as string[]) ?? []} onChange={field.onChange} placeholder={f.placeholder} />
              </Field>
            );

          case 'checkbox':
            return (
              <Field error={error} help={f.helpText}>
                <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm font-medium text-gray-700">
                  <input type="checkbox" disabled={disabled} checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} className="size-4 rounded border-line text-brand-600 focus:ring-brand-400" />
                  {f.label}
                  {f.required && <span className="text-point-red">*</span>}
                </label>
              </Field>
            );

          case 'range': {
            const v = field.value === '' || field.value == null ? (f.defaultValue as number) ?? 0 : Number(field.value);
            return (
              <Field label={`${f.label}: ${v}`} required={f.required} error={error} help={f.helpText}>
                <input type="range" disabled={disabled} min={f.min ?? 0} max={f.max ?? 10} step={f.step ?? 1} value={v} onChange={(e) => field.onChange(Number(e.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-point-green via-point-yellow to-point-red accent-brand-700" />
              </Field>
            );
          }

          case 'mobile':
            return (
              <Field label={f.label} required={f.required} error={error} help={f.helpText}>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-line bg-gray-50 px-2.5 text-sm font-medium text-muted">+91</span>
                  <Input {...common} className="rounded-l-none" inputMode="numeric" maxLength={10} placeholder={f.placeholder ?? '10-digit mobile'} value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 10))} onBlur={field.onBlur} />
                </div>
              </Field>
            );

          case 'money':
            return (
              <Field label={f.label} required={f.required} error={error} help={f.helpText}>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-line bg-gray-50 px-2.5 text-sm font-medium text-muted">₹</span>
                  <Input {...common} className="rounded-l-none" type="number" inputMode="numeric" min={f.min ?? 0} step={f.step ?? 1} value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} onBlur={field.onBlur} />
                </div>
              </Field>
            );

          case 'number':
            return (
              <Field label={f.label} required={f.required} error={error} help={f.helpText}>
                <Input {...common} type="number" min={f.min} max={f.max} step={f.step} placeholder={f.placeholder} value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} onBlur={field.onBlur} />
              </Field>
            );

          case 'pincode':
            return (
              <Field label={f.label} required={f.required} error={error} help={f.helpText}>
                <Input {...common} inputMode="numeric" maxLength={6} placeholder="6-digit PIN" value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} onBlur={field.onBlur} />
              </Field>
            );

          default: {
            const inputType = f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : f.type === 'time' ? 'time' : f.type === 'month' ? 'month' : f.type === 'email' ? 'email' : 'text';
            return (
              <Field label={f.label} required={f.required} error={error} help={f.helpText}>
                <Input {...common} type={inputType} placeholder={f.placeholder} value={(field.value as string) ?? ''} onChange={field.onChange} onBlur={field.onBlur} />
              </Field>
            );
          }
        }
      }}
    />
  );
}
