import { act } from '@testing-library/react'
import { walletScenario } from './review-acceptance-adapter'

const card = { id: 'synthetic-current-card', last4: '4242' }

it('releases a hung lookup after five seconds and ignores its late result', async () => {
    jest.useFakeTimers()
    try {
        const scenario = await walletScenario({ platform: 'android', card, deferLookup: true })
        expect(scenario.state()).toMatchObject({ action: 'none', added: false })
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5000)
        })
        expect(scenario.state()).toMatchObject({ action: 'manual', added: false })
        await scenario.settleLookup({ available: true, alreadyInWallet: false })
        expect(scenario.state()).toMatchObject({ action: 'manual', added: false, nativeAddCalls: 0 })
        scenario.unmount()
    } finally {
        jest.useRealTimers()
    }
})

it('shows the confirmed Apple status once the successful add leaves no target available', async () => {
    const scenario = await walletScenario({ platform: 'ios', card })
    scenario.nextAvailability({ available: false, alreadyInWallet: true })
    await scenario.tapAdd({ added: true })
    expect(scenario.state()).toMatchObject({ action: 'none', added: true, nativeAddCalls: 1 })
    scenario.unmount()
})

it('does not claim an added Apple status when the post-success availability read fails', async () => {
    const scenario = await walletScenario({ platform: 'ios', card })
    scenario.nextAvailability(new Error('synthetic refresh failure'))
    await scenario.tapAdd({ added: true })
    expect(scenario.state()).toMatchObject({ action: 'manual', added: false, nativeAddCalls: 1 })
    scenario.unmount()
})

it('completes a successful Apple add with manual fallback when the refresh never settles', async () => {
    jest.useFakeTimers()
    const scenario = await walletScenario({ platform: 'ios', card })
    try {
        scenario.deferNextLookup()
        const operation = scenario.beginAdd({ added: true })
        await scenario.flush()
        expect(scenario.state().isAdding).toBe(true)
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5000)
        })
        expect(scenario.state()).toMatchObject({ action: 'manual', added: false, isAdding: false })
        await expect(operation).resolves.toMatchObject({ added: true })
        await scenario.resolveNextLookup({ available: false, alreadyInWallet: true })
        expect(scenario.state()).toMatchObject({ action: 'manual', added: false, isAdding: false })
    } finally {
        scenario.unmount()
        jest.useRealTimers()
    }
})

it.each(['android', 'ios'] as const)('ignores a late initial %s lookup after auth is cleared', async (platform) => {
    const scenario = await walletScenario({ platform, card, deferLookup: true })
    await scenario.logout()
    await scenario.settleLookup({ available: true, alreadyInWallet: false })
    expect(scenario.state()).toMatchObject({ action: 'manual', added: false, nativeAddCalls: 0 })
    scenario.unmount()
})

it.each(['android', 'ios'] as const)(
    'does not publish late %s native success after auth is cleared',
    async (platform) => {
        const scenario = await walletScenario({ platform, card })
        scenario.deferNativeAdd()
        const operation = scenario.beginAdd()
        await scenario.flush()
        expect(scenario.state().nativeAddCalls).toBe(1)
        await scenario.logout()
        await scenario.resolveNativeAdd({ added: true })
        await expect(operation).resolves.toMatchObject({ added: false, canceled: true })
        expect(scenario.state()).toMatchObject({ action: 'manual', added: false, isAdding: false, nativeAddCalls: 1 })
        scenario.unmount()
    }
)

it('does not publish Apple refresh confirmation after auth is cleared', async () => {
    const scenario = await walletScenario({ platform: 'ios', card })
    scenario.deferNextLookup()
    const operation = scenario.beginAdd({ added: true })
    await scenario.flush()
    expect(scenario.state().isAdding).toBe(true)
    await scenario.logout()
    await scenario.resolveNextLookup({ available: false, alreadyInWallet: true })
    await expect(operation).resolves.toMatchObject({ added: false, canceled: true })
    expect(scenario.state()).toMatchObject({ action: 'manual', added: false, isAdding: false })
    scenario.unmount()
})
