/* eslint-disable @typescript-eslint/no-explicit-any */
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts'
import { FastifyInstance } from 'fastify'
import { createRoot } from '../src/index.js'

chai.use(chaiAsPromised)
const expect = chai.expect

function createFaker(logs: string[], path: string): any {
  logs.push(path)
  return new Proxy(() => 0, {
    get(_, prop) {
      if (prop === '!fackerPath') return path
      return createFaker(
        logs,
        `${path}.${typeof prop === 'string' ? prop : String(prop)}`
      )
    },
    apply(_, thisArg, args) {
      return createFaker(
        logs,
        `${path}(${args.map((_) => JSON.stringify(_)).join(', ')})`
      )
    }
  })
}

describe('server', () => {
  it('simple usage', () => {
    const root = createRoot<JsonSchemaToTsProvider>()
    const router = root
      .router()
      .handle('GET', '/', (C) => C.handler().handle(async () => 1))
    const logs: string[] = []
    const server = createFaker(logs, 'server') as FastifyInstance
    router.toPlugin()(server, {})
    expect(logs).include(
      'server.route({"method":"GET","url":"/","schema":{},"preHandler":[]})'
    )
  })
})
