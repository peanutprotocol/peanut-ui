/** Frozen observable expectations. The adapter must render real UI/hooks. */
import { walletScenario } from './review-acceptance-adapter'

const CARD_A = { id: 'synthetic-card-a', last4: '4242' }
const CARD_B = { id: 'synthetic-card-b', last4: '4242' }
const AVAILABLE = { available: true, alreadyInWallet: false }
const COARSE_MATCH = { available: true, alreadyInWallet: true }

describe('initial availability and coarse information', () => {
    test.each(['android', 'ios'] as const)(
        '%s pending lookup exposes neither fallback nor added claim',
        async (platform) => {
            const scenario = await walletScenario({ platform, card: CARD_A, deferLookup: true })
            await scenario.flush()
            expect(scenario.state()).toMatchObject({
                action: 'none',
                added: false,
                provisioningCalls: 0,
                nativeAddCalls: 0,
            })
            await scenario.settleLookup(AVAILABLE)
            expect(scenario.state()).toMatchObject({
                action: 'native',
                added: false,
                provisioningCalls: 0,
                nativeAddCalls: 0,
            })
            scenario.unmount()
        }
    )
    test.each(['android', 'ios'] as const)(
        '%s rejected lookup releases pending into manual instructions',
        async (platform) => {
            const scenario = await walletScenario({ platform, card: CARD_A, deferLookup: true })
            await scenario.rejectLookup()
            expect(scenario.state()).toMatchObject({
                action: 'manual',
                added: false,
                provisioningCalls: 0,
                nativeAddCalls: 0,
            })
            scenario.unmount()
        }
    )
    test('Android last-four match retains exact native add even with Rain and historical signals', async () => {
        const scenario = await walletScenario({
            platform: 'android',
            card: CARD_A,
            availability: COARSE_MATCH,
            rainWallets: ['google'],
            historicalCardIds: [CARD_A.id],
        })
        await scenario.flush()
        expect(scenario.state()).toMatchObject({
            action: 'native',
            added: false,
            provisioningCalls: 0,
            nativeAddCalls: 0,
        })
        scenario.unmount()
    })
    test('iOS unavailable native target retains manual instructions even with coarse matches', async () => {
        const scenario = await walletScenario({
            platform: 'ios',
            card: CARD_A,
            availability: { available: false, alreadyInWallet: true },
            rainWallets: ['apple'],
            historicalCardIds: [CARD_A.id],
        })
        await scenario.flush()
        expect(scenario.state()).toMatchObject({
            action: 'manual',
            added: false,
            provisioningCalls: 0,
            nativeAddCalls: 0,
        })
        scenario.unmount()
    })
    test.each([undefined, null, [], {}, ['unsupported'], { wallets: 'google' }])(
        'malformed/missing coarse wallet data %j cannot hide Add',
        async (wallets) => {
            const scenario = await walletScenario({
                platform: 'android',
                card: CARD_A,
                availability: COARSE_MATCH,
                rainWallets: wallets as never,
            })
            await scenario.flush()
            expect(scenario.state()).toMatchObject({ action: 'native', added: false })
            scenario.unmount()
        }
    )
    test.each(['android', 'ios'] as const)(
        '%s flag-off uses existing manual fallback without native operations',
        async (platform) => {
            const scenario = await walletScenario({
                platform,
                flagOn: false,
                card: CARD_A,
                availability: COARSE_MATCH,
                historicalCardIds: [CARD_A.id],
            })
            await scenario.flush()
            expect(scenario.state()).toMatchObject({
                action: 'manual',
                added: false,
                provisioningCalls: 0,
                nativeAddCalls: 0,
            })
            scenario.unmount()
        }
    )
})

describe('only active exact-card native outcomes confirm addition', () => {
    test.each([{ added: true }, { added: false, alreadyInWallet: true }])(
        'Android exact result %j confirms this active card',
        async (outcome) => {
            const scenario = await walletScenario({ platform: 'android', card: CARD_A, availability: AVAILABLE })
            await scenario.flush()
            await scenario.tapAdd(outcome)
            expect(scenario.state()).toMatchObject({
                action: 'none',
                added: true,
                provisioningCalls: 1,
                nativeAddCalls: 1,
            })
            scenario.unmount()
        }
    )
    test('iOS keeps native option when another target remains available', async () => {
        const scenario = await walletScenario({ platform: 'ios', card: CARD_A, availability: AVAILABLE })
        await scenario.flush()
        await scenario.tapAdd({ added: true })
        expect(scenario.state()).toMatchObject({
            action: 'native',
            added: false,
            provisioningCalls: 1,
            nativeAddCalls: 1,
        })
        scenario.unmount()
    })
    test.each([
        { added: false, canceled: true },
        { added: false, error: 'synthetic failure' },
    ])('unsuccessful result %j retains an explicit retry', async (outcome) => {
        const scenario = await walletScenario({ platform: 'android', card: CARD_A, availability: AVAILABLE })
        await scenario.flush()
        await scenario.tapAdd(outcome)
        await scenario.flush()
        expect(scenario.state()).toMatchObject({
            action: 'native',
            added: false,
            provisioningCalls: 1,
            nativeAddCalls: 1,
        })
        await scenario.tapAdd({ added: true })
        expect(scenario.state()).toMatchObject({ action: 'none', added: true, provisioningCalls: 2, nativeAddCalls: 2 })
        scenario.unmount()
    })
    test('fresh visit after earlier local history still exposes Add', async () => {
        const scenario = await walletScenario({
            platform: 'android',
            card: CARD_A,
            availability: COARSE_MATCH,
            historicalCardIds: [CARD_A.id],
        })
        await scenario.flush()
        expect(scenario.state()).toMatchObject({ action: 'native', added: false })
        scenario.unmount()
    })
    test('same-last-four replacement cannot inherit an active-flow exact success', async () => {
        const scenario = await walletScenario({ platform: 'android', card: CARD_A, availability: AVAILABLE })
        await scenario.flush()
        await scenario.tapAdd({ added: true })
        expect(scenario.state().added).toBe(true)
        await scenario.selectCard(CARD_B)
        await scenario.flush()
        expect(scenario.state()).toMatchObject({
            action: 'native',
            added: false,
            provisioningCalls: 1,
            nativeAddCalls: 1,
        })
        scenario.unmount()
    })
})

describe('pending work cannot cross flow boundaries', () => {
    test('duplicate add taps share one provisioning operation', async () => {
        const scenario = await walletScenario({ platform: 'android', card: CARD_A, availability: AVAILABLE })
        await scenario.flush()
        scenario.deferProvisioning()
        const first = scenario.tapAdd()
        await scenario.flush()
        const second = scenario.tapAdd()
        await scenario.flush()
        expect(scenario.state()).toMatchObject({ provisioningCalls: 1, nativeAddCalls: 0, added: false })
        scenario.deferNativeAdd()
        await scenario.resolveProvisioning()
        await scenario.resolveNativeAdd({ added: true })
        await Promise.all([first, second])
        expect(scenario.state()).toMatchObject({ action: 'none', added: true, provisioningCalls: 1, nativeAddCalls: 1 })
        scenario.unmount()
    })
    test.each(['card-change', 'flag-off', 'logout', 'unmount'] as const)(
        '%s while credentials are pending prevents native add',
        async (transition) => {
            const scenario = await walletScenario({ platform: 'android', card: CARD_A, availability: AVAILABLE })
            await scenario.flush()
            scenario.deferProvisioning()
            const addition = scenario.tapAdd()
            await scenario.flush()
            expect(scenario.state()).toMatchObject({ provisioningCalls: 1, nativeAddCalls: 0 })
            if (transition === 'card-change') await scenario.selectCard(CARD_B)
            if (transition === 'flag-off') await scenario.setFlag(false)
            if (transition === 'logout') await scenario.logout()
            if (transition === 'unmount') scenario.unmount()
            await scenario.resolveProvisioning()
            await addition
            expect(scenario.state()).toMatchObject({ nativeAddCalls: 0, provisioningCalls: 1, added: false })
            if (transition === 'card-change') expect(scenario.state().action).toBe('native')
            if (transition === 'flag-off') expect(scenario.state().action).toBe('manual')
            if (transition !== 'unmount') scenario.unmount()
        }
    )
    test('late exact add for previous card cannot publish Added for same-suffix replacement', async () => {
        const scenario = await walletScenario({ platform: 'android', card: CARD_A, availability: AVAILABLE })
        await scenario.flush()
        scenario.deferNativeAdd()
        const addition = scenario.tapAdd()
        await scenario.flush()
        expect(scenario.state().nativeAddCalls).toBe(1)
        await scenario.selectCard(CARD_B)
        await scenario.resolveNativeAdd({ added: true })
        await addition
        expect(scenario.state()).toMatchObject({
            action: 'native',
            added: false,
            provisioningCalls: 1,
            nativeAddCalls: 1,
        })
        scenario.unmount()
    })
    test('late initial lookup cannot restore a native action after flag-off', async () => {
        const scenario = await walletScenario({ platform: 'android', card: CARD_A, deferLookup: true })
        await scenario.setFlag(false)
        await scenario.settleLookup(AVAILABLE)
        expect(scenario.state()).toMatchObject({
            action: 'manual',
            added: false,
            provisioningCalls: 0,
            nativeAddCalls: 0,
        })
        scenario.unmount()
    })
    test('failed credential fetch keeps an explicit retry and never invokes native add', async () => {
        const scenario = await walletScenario({ platform: 'android', card: CARD_A, availability: AVAILABLE })
        await scenario.flush()
        scenario.deferProvisioning()
        const addition = scenario.tapAdd()
        await scenario.flush()
        await scenario.rejectProvisioning()
        await addition
        expect(scenario.state()).toMatchObject({
            action: 'native',
            added: false,
            provisioningCalls: 1,
            nativeAddCalls: 0,
        })
        scenario.unmount()
    })
})
