import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';

type Source = 'body' | 'query' | 'params';

/** Validates one request part with zod and stores the parsed value on req.validated[source]. */
export function validate<T extends ZodTypeAny>(schema: T, source: Source = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    req.validated = req.validated ?? {};
    req.validated[source] = result.data;
    next();
  };
}

export function body<T extends ZodTypeAny>(req: { validated: { body?: unknown } }): z.infer<T> {
  return req.validated.body as z.infer<T>;
}
export function query<T extends ZodTypeAny>(req: { validated: { query?: unknown } }): z.infer<T> {
  return req.validated.query as z.infer<T>;
}
