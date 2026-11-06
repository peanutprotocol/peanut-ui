import { fileURLToPath } from 'node:url'

process.env.EXPANDED_FLOW_ADAPTER = fileURLToPath(new URL('./expanded-flow-adapter.mjs', import.meta.url))
await import('./expanded-flow-contract.mjs')
