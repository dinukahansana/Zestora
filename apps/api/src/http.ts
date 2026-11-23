import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { z } from 'zod';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: { field: string; message: string }[];

  constructor(status: number, code: string, message: string, fields?: HttpError['fields']) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields = result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message }));
  throw new HttpError(400, 'INVALID_INPUT', 'Check the request values.', fields);
}

export const notFound: RequestHandler = () => {
  throw new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.');
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message, fields: error.fields } });
    return;
  }
  if (typeof error === 'object' && error !== null && 'type' in error) {
    if (error.type === 'entity.parse.failed') {
      response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Send a valid JSON body.' } });
      return;
    }
    if (error.type === 'entity.too.large') {
      response.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'The request body is too large.' } });
      return;
    }
  }
  console.error('Unhandled API error:', error instanceof Error ? error.name : 'Unknown');
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } });
};

export function isDuplicateKey(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
