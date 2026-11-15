/** The frozen assertions are required once through this production binding.
 * Contract: https://github.com/peanutprotocol/mono/blob/main/engineering/ui/card-predispatch-contract.md */
Object.assign(global, require('node:stream/web'))
Object.assign(global, { MessagePort: require('node:worker_threads').MessagePort })
const transportPrimitives = require('next/dist/compiled/@edge-runtime/primitives/fetch')
global.Response = transportPrimitives.Response
global.Request = transportPrimitives.Request
global.Headers = transportPrimitives.Headers
process.env.PEANUT_PREDISPATCH_ADAPTER = require.resolve('./predispatch.production-adapter')
require('./predispatch.assertions')
