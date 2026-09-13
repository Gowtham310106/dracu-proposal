import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import type { ZodTypeAny } from 'zod';

/**
 * FormRenderer drives every form off `Record<string, unknown>` values (field keys come from the
 * shared FieldDescriptor lists, not from a static TS shape). zodResolver infers the schema's own
 * output type, so this adapts it to the generic value type the renderer uses.
 */
export function resolver(schema: ZodTypeAny): Resolver<Record<string, unknown>> {
  return zodResolver(schema) as unknown as Resolver<Record<string, unknown>>;
}

/** Strips undefined/null so an existing record can seed react-hook-form defaults. */
export function toDefaults(record: object | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries((record ?? {}) as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null));
}
