/**
 * jest's moduleNameMapper stubs `@/config/wagmi.config` for the whole suite, so
 * nothing otherwise loads the real module. Required by relative path here (the
 * mapper pattern is anchored to the alias) to pin the one thing that keeps the
 * app shell alive in restricted documents: createConfig must be handed our
 * guarded storage, never wagmi's default, whose getDefaultStorage() reads
 * window.localStorage unguarded at module scope (PEANUT-UI-STF).
 */
import { resilientWebStorage } from '@/utils/safe-storage'

const createConfig = jest.fn(() => ({}))
const createStorage = jest.fn(() => ({ key: 'wagmi' }))

// mocking 'wagmi' shadows 'wagmi/chains' too, so the chains live here as well
jest.mock('wagmi', () => {
    const chain = (id: number) => ({ id })
    return {
        __esModule: true,
        createConfig: (...args: unknown[]) => createConfig(...(args as [])),
        createStorage: (...args: unknown[]) => createStorage(...(args as [])),
        http: () => ({}),
        WagmiProvider: () => null,
        cookieToInitialState: () => undefined,
        arbitrum: chain(42161),
        bsc: chain(56),
        celo: chain(42220),
        gnosis: chain(100),
        linea: chain(59144),
        mainnet: chain(1),
        optimism: chain(10),
        polygon: chain(137),
        scroll: chain(534352),
        worldchain: chain(480),
    }
})

it('builds the wagmi config with the guarded storage adapter', () => {
    require('../wagmi.config')

    expect(createStorage).toHaveBeenCalledWith({ storage: resilientWebStorage })

    const [parameters] = createConfig.mock.calls[0] as unknown as [{ storage?: unknown }]
    expect(parameters.storage).toBe(createStorage.mock.results[0].value)
})
