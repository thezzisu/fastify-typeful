import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts'
import { createRoot, GetRouterDescriptor } from '../src/server.js'
import { createClient } from '../src/client.js'
import fastify from 'fastify'

const root = createRoot<JsonSchemaToTsProvider>()
const router = root
  .router()
  .route('/user', (C) =>
    C.router()
      .route('/admin', (C) =>
        C.router().handle('GET', '/', (C) =>
          C.handler()
            .query({
              type: 'object'
            } as const)
            .response(200, {
              type: 'object'
            } as const)
            .handle(async (_, req) => {
              return { pong: req.query['ping'] }
            })
        )
      )
      .handle('POST', '/', (C) =>
        C.handler()
          .body({
            type: 'object'
          } as const)
          .handle(async () => {
            return {
              hello: 1
            }
          })
      )
  )
  .route('/misc', (C) =>
    C.router().handle('GET', '/', (C) => C.handler().handle(async () => 123))
  )

const server = fastify()
server.register(router.toPlugin())
await server.listen({
  port: 3000
})

console.log(server.printPlugins())
console.log(server.printRoutes())

const client = createClient<GetRouterDescriptor<typeof router>>(
  'http://127.0.0.1:3000'
)
console.log(await client.user.$post.body({}).fetch())
