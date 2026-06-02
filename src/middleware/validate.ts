import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';
import ApiError from '../utils/ApiError.js';

type Source = 'body' | 'query' | 'params';

// Parse `data` against a Zod schema, throwing ApiError(400) with a flattened
// `path: message` detail string on failure. Shared by the `validate`
// middleware and controllers (e.g. the unified search dispatcher) that pick a
// schema at request time, so the 400 error shape stays identical everywhere.
export function parseOrThrow<T>(schema: ZodType<T>, data: unknown, source: Source = 'body'): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.length ? i.path.join('.') : source}: ${i.message}`)
      .join('; ');
    throw new ApiError(400, detail);
  }
  return result.data;
}

// Validate `req[source]` against a Zod schema. On success the parsed
// (sanitised + coerced) value replaces the original so downstream handlers
// see only the validated shape.
//
// Express 5 made `req.query` a getter-only property — direct reassignment
// throws. We mutate the underlying object in place for query/params (both
// configured the same way) and reassign for body (still writable).
export const validate =
  (schema: ZodType, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    let data: unknown;
    try {
      data = parseOrThrow(schema, req[source], source);
    } catch (err) {
      return next(err);
    }

    if (source === 'body') {
      (req as Request & { body: unknown }).body = data;
    } else {
      // In-place mutation for query / params (Express 5 getters).
      const target = req[source] as Record<string, unknown>;
      for (const k of Object.keys(target)) delete target[k];
      Object.assign(target, data as Record<string, unknown>);
    }
    next();
  };

export default validate;
