/* eslint-disable @typescript-eslint/no-explicit-any */

export const wellKnownMethods = [
  'DELETE',
  'GET',
  'HEAD',
  'PATCH',
  'POST',
  'PUT',
  'OPTIONS',
  'PROPFIND',
  'PROPPATCH',
  'MKCOL',
  'COPY',
  'MOVE',
  'LOCK',
  'UNLOCK',
  'TRACE',
  'SEARCH'
] as const

export type Method = typeof wellKnownMethods[number]

export function isValidSlug(slug: string): boolean {
  return /^[a-zA-Z0-9-]+$/.test(slug) && !wellKnownMethods.includes(<never>slug)
}

export function deepAssign(target: any, ...sources: any[]): any {
  for (const source of sources) {
    for (const key in source) {
      const targetValue = target[key]
      const sourceValue = source[key]

      if (targetValue && typeof targetValue === 'object') {
        deepAssign(targetValue, sourceValue)
      } else {
        target[key] = sourceValue
      }
    }
  }

  return target
}

export interface EndpointSchema<
  Body,
  Query,
  Params,
  Headers,
  Response extends Record<number, any>
> {
  body: Body
  querystring: Query
  params: Params
  headers: Headers
  response: Response
}

export interface HandlerDescriptor<
  Schema extends EndpointSchema<any, any, any, any, any>
> {
  schema: Schema
}

export type RouteDescriptor =
  | RouterDescriptor<any>
  | Record<string, HandlerDescriptor<any>>

export interface RouterDescriptor<
  Routes extends Record<string, RouteDescriptor>
> {
  routes: Routes
}

export type Id<T> = T extends infer U ? { [K in keyof U]: U[K] } : never

export type Is<T, S> = T extends S ? (S extends T ? true : false) : false

export type Awaitable<T> = T | Promise<T>

// eslint-disable-next-line @typescript-eslint/ban-types
export type UndefinedToEmpty<T> = Is<T, undefined> extends true ? {} : T
