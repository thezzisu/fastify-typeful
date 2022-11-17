/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types */
import type {
  FastifyRequest,
  FastifyReply,
  FastifyTypeProvider,
  FastifySchema,
  ContextConfigDefault,
  FastifyBaseLogger,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
  RouteGenericInterface,
  RouteHandlerMethod,
  RawReplyDefaultExpression,
  RouteShorthandOptions,
  FastifyPluginAsync,
  FastifyInstance,
  HTTPMethods
} from 'fastify'
import type {
  CallTypeProvider,
  FastifyTypeProviderDefault
} from 'fastify/types/type-provider.js'
import type { HandlerDescriptor, RouterDescriptor } from 'typeful-fetch'

type Is<S, T> = S extends T ? (T extends S ? true : false) : false
type Id<T> = T extends infer U ? { [K in keyof U]: U[K] } : never
type Method = HTTPMethods
type UndefinedToEmpty<T> = Is<T, undefined> extends true ? {} : T

declare module 'fastify' {
  export interface FastifyRequest {
    tctx: unknown
  }
}

function notImplemented(): never {
  throw new Error('Not implemented')
}

export interface ITransformer<InCtx, OutCtx> {
  (context: InCtx, request: FastifyRequest, reply: FastifyReply):
    | OutCtx
    | Promise<OutCtx>
}

export class ContextChain<Provider extends FastifyTypeProvider, InCtx, OutCtx> {
  constructor(public _transformers: ITransformer<any, any>[]) {}

  withTypeProvider<NewProvider extends FastifyTypeProvider>(): ContextChain<
    NewProvider,
    InCtx,
    OutCtx
  > {
    return this
  }

  transform<NewCtx>(
    fn: ITransformer<OutCtx, NewCtx>
  ): ContextChain<Provider, InCtx, NewCtx> {
    const copy = new ContextChain<Provider, InCtx, NewCtx>(
      this._transformers.slice()
    )
    copy._transformers.push(fn)
    return copy
  }

  router(): Router<this, {}> {
    return new Router(this, {})
  }

  handler(): Handler<this, {}> {
    return new Handler(this, {}, notImplemented, {})
  }
}

export type GetProviderOfChain<C extends ContextChain<any, any, any>> =
  C extends ContextChain<infer P, any, any> ? P : never
export type GetInContextOfChain<C extends ContextChain<any, any, any>> =
  C extends ContextChain<any, infer I, any> ? I : never
export type GetOutContextOfChain<C extends ContextChain<any, any, any>> =
  C extends ContextChain<any, any, infer O> ? O : never
export type ToRoot<C extends ContextChain<any, any, any>> =
  C extends ContextChain<infer P, any, infer O> ? ContextChain<P, O, O> : never

type InferSubRouter<C extends ContextChain<any, any, any>> = Router<
  ContextChain<GetOutContextOfChain<C>, any, any>,
  any
>
type InferSubHandler<C extends ContextChain<any, any, any>> = Handler<
  ContextChain<GetOutContextOfChain<C>, any, any>,
  any
>
type InferSubHandlerMap<C extends ContextChain<any, any, any>> = Record<
  Method,
  InferSubHandler<C>
>

export class Router<
  C extends ContextChain<any, any, any>,
  Routes extends Record<string, InferSubRouter<C> | InferSubHandlerMap<C>>
> {
  constructor(public _chain: C, public _routes: Routes) {}

  route<P extends string, R extends InferSubRouter<C>>(
    path: P,
    router: R | ((chain: ToRoot<C>) => R)
  ): Router<C, Id<Routes & { [K in P]: R }>> {
    if (router instanceof Function) {
      router = router(this.asRoot())
    }
    return <never>(
      new Router(
        this._chain,
        Object.assign({}, this._routes, { [path]: router })
      )
    )
  }

  handle<M extends Method, P extends string, H extends InferSubHandler<C>>(
    method: M,
    path: P,
    handler: H | ((chain: ToRoot<C>) => H)
  ): Router<
    C,
    Id<Omit<Routes, P> & { [K in P]: Routes[P] & { [J in M]: H } }>
  > {
    if (handler instanceof Function) {
      handler = handler(this.asRoot())
    }
    const oldMap = this._routes[path] ?? {}
    if (oldMap instanceof Router) {
      throw new Error(`Conflict path at ${path}`)
    }
    return <never>new Router(
      this._chain,
      Object.assign({}, this._routes, {
        [path]: Object.assign({}, oldMap, { [method]: handler })
      })
    )
  }

  asRoot(): ToRoot<C> {
    return <never>new ContextChain([])
  }

  toPlugin(): FastifyPluginAsync {
    return async (server) => {
      if (!server.hasRequestDecorator('tctx')) {
        server.decorateRequest('tctx', null)
      }
      for (const transformer of this._chain._transformers) {
        server.addHook('preHandler', async (req, rep) => {
          req.tctx = await transformer(req.tctx, req, rep)
        })
      }
      for (const [path, route] of Object.entries(this._routes)) {
        if (route instanceof Router) {
          server.register(route.toPlugin(), { prefix: path })
        } else {
          for (const [method, handler] of Object.entries(route)) {
            handler.mount(<Method>method, path, server)
          }
        }
      }
    }
  }
}

type PrependContext<
  C extends ContextChain<any, any, any>,
  Fn extends (...args: any[]) => any
> = (ctx: GetOutContextOfChain<C>, ...args: Parameters<Fn>) => ReturnType<Fn>
type InferRouteHandlerMethod<
  C extends ContextChain<any, any, any>,
  SchemaCompiler extends FastifySchema,
  RouteGeneric extends RouteGenericInterface = RouteGenericInterface,
  RawServer extends RawServerBase = RawServerDefault,
  RawRequest extends RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
  RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
  ContextConfig = ContextConfigDefault,
  Logger extends FastifyBaseLogger = FastifyBaseLogger
> = PrependContext<
  C,
  RouteHandlerMethod<
    RawServer,
    RawRequest,
    RawReply,
    RouteGeneric,
    ContextConfig,
    SchemaCompiler,
    GetProviderOfChain<C>,
    Logger
  >
>
type InferRouteHandlerArgs<
  C extends ContextChain<any, any, any>,
  SchemaCompiler extends FastifySchema,
  RouteGeneric extends RouteGenericInterface = RouteGenericInterface,
  RawServer extends RawServerBase = RawServerDefault,
  RawRequest extends RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
  RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
  ContextConfig = ContextConfigDefault,
  Logger extends FastifyBaseLogger = FastifyBaseLogger
> = Parameters<
  InferRouteHandlerMethod<
    C,
    SchemaCompiler,
    RouteGeneric,
    RawServer,
    RawRequest,
    RawReply,
    ContextConfig,
    Logger
  >
>
type InferRouteHandlerReturn<
  C extends ContextChain<any, any, any>,
  SchemaCompiler extends FastifySchema,
  RouteGeneric extends RouteGenericInterface = RouteGenericInterface,
  RawServer extends RawServerBase = RawServerDefault,
  RawRequest extends RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
  RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
  ContextConfig = ContextConfigDefault,
  Logger extends FastifyBaseLogger = FastifyBaseLogger
> = Is<SchemaCompiler['response'], undefined> extends true
  ? unknown
  : ReturnType<
      InferRouteHandlerMethod<
        C,
        SchemaCompiler,
        RouteGeneric,
        RawServer,
        RawRequest,
        RawReply,
        ContextConfig,
        Logger
      >
    >
type InferRouteOptions<
  C extends ContextChain<any, any, any>,
  SchemaCompiler extends FastifySchema,
  RawServer extends RawServerBase = RawServerDefault,
  RawRequest extends RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
  RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
  RouteGeneric extends RouteGenericInterface = RouteGenericInterface,
  ContextConfig = ContextConfigDefault,
  Logger extends FastifyBaseLogger = FastifyBaseLogger
> = RouteShorthandOptions<
  RawServer,
  RawRequest,
  RawReply,
  RouteGeneric,
  ContextConfig,
  SchemaCompiler,
  GetProviderOfChain<C>,
  Logger
>
type Infer200Response<Schema extends FastifySchema> =
  200 extends keyof Schema['response'] ? Schema['response'][200] : undefined
type InferReturn<
  Provider extends FastifyTypeProvider,
  Schema extends FastifySchema
> = Infer200Response<Schema> extends infer U
  ? Is<U, undefined> extends true
    ? '_inferedReturn' extends keyof Schema
      ? Schema['_inferedReturn']
      : unknown
    : CallTypeProvider<Provider, U>
  : never
type InferSchemaWithHandler<Schema extends FastifySchema, Return> = Is<
  Infer200Response<Schema>,
  undefined
> extends true
  ? Id<Schema & { _inferedReturn: Awaited<Return> }>
  : Schema
type InferSchemaWithResponse<
  Schema extends FastifySchema,
  K extends number,
  Response
> = Id<
  Omit<Schema, 'response'> & {
    response: Id<
      Omit<UndefinedToEmpty<Schema['response']>, K> & { [J in K]: Response }
    >
  }
>

export class Handler<
  C extends ContextChain<any, any, any>,
  Schema extends FastifySchema
> {
  constructor(
    public _chain: C,
    public _schema: Schema,
    public _handler: InferRouteHandlerMethod<C, Schema>,
    public _options: InferRouteOptions<C, Schema>
  ) {}

  body<S>(schema: S): Handler<C, Id<Omit<Schema, 'body'> & { body: S }>> {
    return <never>(
      new Handler(
        this._chain,
        Object.assign({}, this._schema, { body: schema }),
        this._handler,
        this._options
      )
    )
  }

  query<S>(
    schema: S
  ): Handler<C, Id<Omit<Schema, 'querystring'> & { querystring: S }>> {
    return <never>(
      new Handler(
        this._chain,
        Object.assign({}, this._schema, { querystring: schema }),
        this._handler,
        this._options
      )
    )
  }

  params<S>(schema: S): Handler<C, Id<Omit<Schema, 'params'> & { params: S }>> {
    return <never>(
      new Handler(
        this._chain,
        Object.assign({}, this._schema, { params: schema }),
        this._handler,
        this._options
      )
    )
  }

  headers<S>(
    schema: S
  ): Handler<C, Id<Omit<Schema, 'headers'> & { headers: S }>> {
    return <never>(
      new Handler(
        this._chain,
        Object.assign({}, this._schema, { headers: schema }),
        this._handler,
        this._options
      )
    )
  }

  response<K extends number, S>(
    code: K,
    schema: S
  ): Handler<C, InferSchemaWithResponse<Schema, K, S>> {
    const oldResponse = this._schema.response ?? {}
    return <never>new Handler(
      this._chain,
      Object.assign({}, this._schema, {
        response: Object.assign({}, oldResponse, { [code]: schema })
      }),
      this._handler,
      this._options
    )
  }

  handle<Return extends InferRouteHandlerReturn<C, Schema>>(
    handler: (...args: InferRouteHandlerArgs<C, Schema>) => Return
  ): Handler<C, InferSchemaWithHandler<Schema, Return>> {
    return <never>(
      new Handler(
        this._chain,
        Object.assign({}, this._schema),
        <never>handler,
        this._options
      )
    )
  }

  options(options: InferRouteOptions<C, Schema>): Handler<C, Schema> {
    return <never>(
      new Handler(
        this._chain,
        Object.assign({}, this._schema),
        this._handler,
        options
      )
    )
  }

  mount(method: Method, url: string, server: FastifyInstance) {
    server.route({
      ...(this._options as unknown as RouteShorthandOptions),
      method,
      url,
      schema: this._schema,
      preHandler: <never>this._chain._transformers.map(
        (transformer) => async (req: any, rep: any) => {
          req.tctx = await transformer(req.tctx, req, rep)
        }
      ),
      handler: (req, rep) => (this._handler as any)(req.tctx, req, rep)
    })
  }
}

export function createRoot<
  Provider extends FastifyTypeProvider = FastifyTypeProviderDefault
>() {
  return new ContextChain<Provider, null, null>([])
}

export type MapFastifySchema<
  Provider extends FastifyTypeProvider,
  Schema extends FastifySchema
> = Id<
  {
    [K in 'body' | 'querystring' | 'params' | 'headers']: CallTypeProvider<
      Provider,
      Schema[K]
    >
  } & {
    response: Id<
      {
        [K in Exclude<keyof Schema['response'], 200>]: CallTypeProvider<
          Provider,
          Schema['response'][K]
        >
      } & {
        200: InferReturn<Provider, Schema>
      }
    >
  }
>

export type GetHandlerDescriptor<H extends Handler<any, any>> =
  HandlerDescriptor<
    MapFastifySchema<GetProviderOfChain<H['_chain']>, H['_schema']>
  >

export type GetRouterDescriptor<R extends Router<any, any>> = RouterDescriptor<{
  [K in keyof R['_routes']]: R['_routes'][K] extends infer U
    ? U extends Router<any, any>
      ? GetRouterDescriptor<U>
      : {
          [J in keyof U]: U[J] extends infer V
            ? V extends Handler<any, any>
              ? GetHandlerDescriptor<V>
              : never
            : never
        }
    : never
}>
