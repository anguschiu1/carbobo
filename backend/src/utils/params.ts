import type { Request } from 'express'

/** Get a route param as string (Express can give string | string[]). */
export function param(req: Request, name: string): string {
  const v = req.params[name]
  return Array.isArray(v) ? v[0] ?? '' : v ?? ''
}
