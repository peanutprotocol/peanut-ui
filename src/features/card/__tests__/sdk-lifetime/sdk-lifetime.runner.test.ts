/** Frozen assertions registered against the actual web SDK integration. */
jest.mock('vitest', () => ({ describe, it, expect }), { virtual: true })
import { sdkLifetimeAcceptance } from './acceptance.assertions'
import { webAdapter } from './web.production-adapter'
import type { Harness, Identity } from './adapter-contract'

// The frozen cases all supply this fixture. Mount the real page as test setup
// so slow module/query initialization does not consume the assertion deadline.
const initial: Identity = { owner: 'user-a', scope: 'a'.repeat(64), generation: 'generation-a' }
let mounted: Harness
beforeEach(async () => {
    mounted = await webAdapter.mount(initial)
})
sdkLifetimeAcceptance({
    ...webAdapter,
    mount: async (identity) => {
        if (JSON.stringify(identity) !== JSON.stringify(initial)) throw new Error('Unexpected SDK test fixture')
        return mounted
    },
})
