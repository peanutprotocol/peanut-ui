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
