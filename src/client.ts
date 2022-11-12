/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  deepAssign,
  HandlerDescriptor,
  Id,
  RouterDescriptor
} from './common.js'
import qs from 'qs'

export type IClientHandlerOptions = Omit<RequestInit, 'method'>

export class HandlerFetchError extends Error {
  constructor(public response: Response) {
    super(response.statusText)
  }
}

export class ClientHandler<H extends HandlerDescriptor<any>> {
  constructor(
    public _options: RequestInit,
    public _path: string,
    public _method: string,
    public _info: H['schema']
  ) {}

  body(body: H['schema']['body']): ClientHandler<H> {
    return new ClientHandler(
      this._options,
      this._path,
      this._method,
      Object.assign({}, this._info, { body })
    )
  }

  query(query: H['schema']['querystring']): ClientHandler<H> {
    return new ClientHandler(
      this._options,
      this._path,
      this._method,
      Object.assign({}, this._info, { query })
    )
  }

  params(params: H['schema']['params']): ClientHandler<H> {
    return new ClientHandler(
      this._options,
      this._path,
      this._method,
      Object.assign({}, this._info, { params })
    )
  }

  headers(headers: H['schema']['headers']): ClientHandler<H> {
    return new ClientHandler(
      this._options,
      this._path,
      this._method,
      Object.assign({}, this._info, { headers })
    )
  }

  async fetch(options: RequestInit = {}) {
    console.log(this._path)
    const resp = await fetch(
      this._path + '?' + qs.stringify(this.query ?? {}),
      deepAssign(
        {},
        this._options,
        {
          method: this._method,
          headers: {
            'Content-Type': 'application/json',
            ...(this._info.headers ?? {})
          },
          body: this._method === 'GET' ? null : JSON.stringify(this._info.body)
        },
        options
      )
    )
    if (!resp.ok) throw new HandlerFetchError(resp)
    return resp.json() as Promise<H['schema']['response'][200]>
  }
}

type RemovePrefixSlash<S> = S extends `/${infer T}` ? T : S
type NoEmpty<S> = S extends '' ? never : S

type InferClientSub<
  R extends RouterDescriptor<any>,
  K
> = K extends keyof R['routes']
  ? R['routes'][K] extends RouterDescriptor<any>
    ? InferClient<R['routes'][K]>
    : {
        [M in keyof R['routes'][K] as M extends string | number
          ? `$${Lowercase<`${M}`>}`
          : never]: ClientHandler<R['routes'][K][M]>
      }
  : // eslint-disable-next-line @typescript-eslint/ban-types
    {}

type InferClient<R extends RouterDescriptor<any>> = Id<
  {
    [K in keyof R['routes'] as NoEmpty<RemovePrefixSlash<K>>]: InferClientSub<
      R,
      K
    >
  } & InferClientSub<R, ''> &
    InferClientSub<R, '/'>
>

export function createClient<R extends RouterDescriptor<any>>(
  path: string,
  options: RequestInit = {}
): InferClient<R> {
  return <any>new Proxy(
    {},
    {
      get(_, p) {
        if (typeof p !== 'string')
          throw new Error('Only string props are allowed')
        if (p.startsWith('$'))
          return new ClientHandler(
            options,
            path,
            p.substring(1).toUpperCase(),
            {}
          )
        return (createClient as any)(`${path}/${p}`, options)
      }
    }
  )
}
