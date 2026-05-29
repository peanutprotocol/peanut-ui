import {
    deriveGate,
    getGateUserMessage,
    getKycModalVariant,
    type CapabilityState,
    type GateState,
} from './capability-gate'
import type { NextAction, RailCapability } from '@/types/capabilities'

/**
 * Capability-gate tests focused on the priority order, in particular the new
 * `waiting-on-provider` branch (from the BE adding `kind: 'wait'` NextActions
 * for `wait:bridge` — Bridge internal review / post-processing / generic
 * Stripe lookups). Without this branch, a rail in `requires-info` with only a
 * `wait` action falls through to `needs-enrollment` and the user sees a
 * misleading "verify your identity" CTA when there's nothing for them to do.
 */

function bankRail(overrides: Partial<RailCapability> = {}): RailCapability {
    return {
        id: 'bridge.ach_us',
        provider: 'bridge',
        method: 'ACH_US',
        channel: 'bank',
        country: 'US',
        currency: 'USD',
        status: 'enabled',
        ...overrides,
    }
}

function state(rails: RailCapability[], nextActions: NextAction[] = [], identityVerified = true): CapabilityState {
    return { rails, nextActions, identityVerified, isLoading: false }
}

describe('deriveGate — waiting-on-provider (kind: wait)', () => {
    const waitAction: NextAction = { key: 'wait:bridge', kind: 'wait', purpose: 'bridge-review' }

    test('requires-info rail with only a `wait` action → waiting-on-provider', () => {
        const rail = bankRail({
            id: 'bridge.sepa_eu',
            method: 'SEPA_EU',
            country: 'EU',
            currency: 'EUR',
            status: 'requires-info',
            blockingActions: ['wait:bridge'],
            reason: {
                code: 'bridge_processing',
                userMessage: 'We’re finalizing your verification with Bridge — this usually takes a few minutes.',
            },
        })

        const gate = deriveGate(state([rail], [waitAction]), 'deposit', { channel: 'bank' })

        expect(gate.kind).toBe('waiting-on-provider')
        if (gate.kind === 'waiting-on-provider') {
            expect(gate.userMessage).toMatch(/finalizing your verification/)
            expect(gate.reason?.code).toBe('bridge_processing')
        }
    })

    test('priority: accept-tos beats waiting-on-provider (ToS is user-actionable)', () => {
        const tosAction: NextAction = { key: 'accept-tos', kind: 'accept-tos', purpose: 'accept-bridge-tos' }
        // Two rails in scope: one needs ToS, one is mid-review. Bank scope.
        const rails = [
            bankRail({
                id: 'bridge.sepa_eu',
                method: 'SEPA_EU',
                country: 'EU',
                currency: 'EUR',
                status: 'requires-info',
                blockingActions: ['wait:bridge'],
            }),
            bankRail({
                id: 'bridge.ach_us',
                status: 'requires-info',
                blockingActions: ['accept-tos'],
                reason: { code: 'bridge_tos_required', userMessage: 'Accept the Bridge terms to continue.' },
            }),
        ]
        const gate = deriveGate(state(rails, [tosAction, waitAction]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('accept-tos')
    })

    test('priority: fixable-rejection beats waiting-on-provider (actionable wins)', () => {
        // If ANY in-scope rail has a sumsub action, surface that — the user
        // can act on it and unblock part of the scope. Don't gate them on
        // wait copy when they have something they can do.
        const sumsubAction: NextAction = {
            key: 'sumsub:tax_identification_number',
            kind: 'sumsub',
            purpose: 'unlock-bridge',
            levelKey: 'tax_identification_number',
        }
        const rails = [
            bankRail({
                id: 'bridge.ach_us',
                status: 'requires-info',
                blockingActions: ['wait:bridge'],
            }),
            bankRail({
                id: 'bridge.sepa_eu',
                method: 'SEPA_EU',
                country: 'EU',
                currency: 'EUR',
                status: 'requires-info',
                blockingActions: ['sumsub:tax_identification_number'],
            }),
        ]
        const gate = deriveGate(state(rails, [waitAction, sumsubAction]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('fixable-rejection')
    })

    test("priority: ready beats waiting-on-provider (don't block the user from a usable rail)", () => {
        // User has SEPA waiting AND ACH ready — let them use ACH instead of
        // showing wait copy that prevents the whole scope.
        const rails = [
            bankRail({
                id: 'bridge.sepa_eu',
                method: 'SEPA_EU',
                country: 'EU',
                currency: 'EUR',
                status: 'requires-info',
                blockingActions: ['wait:bridge'],
            }),
            bankRail({
                id: 'bridge.ach_us',
                status: 'enabled',
            }),
        ]
        const gate = deriveGate(state(rails, [waitAction]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('ready')
    })

    test('priority: pending beats waiting-on-provider (provisioning is also a wait, but more concrete)', () => {
        const rails = [
            bankRail({
                id: 'bridge.sepa_eu',
                method: 'SEPA_EU',
                country: 'EU',
                currency: 'EUR',
                status: 'requires-info',
                blockingActions: ['wait:bridge'],
            }),
            bankRail({
                id: 'bridge.ach_us',
                status: 'pending',
            }),
        ]
        const gate = deriveGate(state(rails, [waitAction]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('pending')
    })

    test('priority: waiting-on-provider beats needs-identity / needs-enrollment', () => {
        // ONLY a wait-only rail in scope, identity not verified → without this
        // priority the gate would land on `needs-identity` and show "verify
        // your identity" — which is wrong when a Bridge customer EXISTS and
        // is being reviewed. Surface the wait copy instead.
        const rail = bankRail({
            id: 'bridge.sepa_eu',
            method: 'SEPA_EU',
            country: 'EU',
            currency: 'EUR',
            status: 'requires-info',
            blockingActions: ['wait:bridge'],
        })
        const gate = deriveGate(state([rail], [waitAction], /* identityVerified */ false), 'deposit', {
            channel: 'bank',
        })
        expect(gate.kind).toBe('waiting-on-provider')
    })

    test('rail with BOTH wait AND sumsub actions → fixable-rejection (user has something to do)', () => {
        // Defensive: the BE shouldn't emit this combo today (waits suppress
        // sumsub actions in the resolver), but if it ever does we surface the
        // actionable branch rather than asking the user to wait.
        const sumsubAction: NextAction = {
            key: 'sumsub:tax_identification_number',
            kind: 'sumsub',
            purpose: 'unlock-bridge',
            levelKey: 'tax_identification_number',
        }
        const rail = bankRail({
            id: 'bridge.ach_us',
            status: 'requires-info',
            blockingActions: ['wait:bridge', 'sumsub:tax_identification_number'],
        })
        const gate = deriveGate(state([rail], [waitAction, sumsubAction]), 'deposit', { channel: 'bank' })
        // wait-only branch requires `every action is wait` — mixed-action rail
        // falls through and the fixable-rejection branch catches it.
        expect(gate.kind).toBe('fixable-rejection')
    })

    test('rail with NO actions stays out of waiting-on-provider (would falsely match `every of empty = true`)', () => {
        // Edge case: a requires-info rail with no blockingActions should NOT be
        // misclassified as waiting-on-provider (Array.every returns true on []).
        // Our predicate guards with actions.length > 0.
        const rail = bankRail({
            id: 'bridge.ach_us',
            status: 'requires-info',
            blockingActions: [],
        })
        const gate = deriveGate(state([rail], []), 'deposit', { channel: 'bank' })
        expect(gate.kind).not.toBe('waiting-on-provider')
    })

    test('a wait action with no in-scope rail returns whatever the scope deserves', () => {
        // Manteca BR rail in scope (channel filtered out — only bank); Bridge SEPA
        // out of scope (country=EU not selected). Wait action exists but doesn't
        // match any in-scope rail, so we fall through.
        const rail = bankRail({
            id: 'manteca.pix_br',
            provider: 'manteca',
            method: 'PIX_BR',
            country: 'BR',
            currency: 'BRL',
            status: 'enabled',
        })
        const gate = deriveGate(state([rail], [waitAction]), 'deposit', { channel: 'bank', country: 'BR' })
        expect(gate.kind).toBe('ready')
    })
})

describe('deriveGate — accept-tos carries reason for downstream copy variation', () => {
    test('accept-tos GateState propagates rail reason (SEPA v2 vs base)', () => {
        const tosAction: NextAction = { key: 'accept-tos:sepa', kind: 'accept-tos', purpose: 'accept-bridge-tos-sepa' }
        const rail = bankRail({
            id: 'bridge.sepa_eu',
            method: 'SEPA_EU',
            country: 'EU',
            currency: 'EUR',
            status: 'requires-info',
            blockingActions: ['accept-tos:sepa'],
            reason: {
                code: 'bridge_tos_v2_required',
                userMessage: 'Accept the SEPA terms of service to enable EUR / GBP rails.',
            },
        })
        const gate = deriveGate(state([rail], [tosAction]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('accept-tos')
        if (gate.kind === 'accept-tos') {
            expect(gate.reason?.code).toBe('bridge_tos_v2_required')
            expect(gate.userMessage).toMatch(/SEPA terms/)
        }
    })
})

describe('getGateUserMessage', () => {
    test('returns userMessage for waiting-on-provider', () => {
        const gate: GateState = {
            kind: 'waiting-on-provider',
            userMessage: 'We’re finalizing with Bridge.',
        }
        expect(getGateUserMessage(gate)).toBe('We’re finalizing with Bridge.')
    })
})

describe('getKycModalVariant — waiting-on-provider', () => {
    test('maps to default (no specialized modal copy yet — consumers suppress modal entirely)', () => {
        // The dispatch sites prevent the modal from opening when gate.kind is
        // 'waiting-on-provider' (treated like 'loading'). This mapping is a
        // belt-and-braces fallback if the modal does open: generic copy beats
        // a misleading "needs-enrollment" / "cross-region" variant.
        expect(getKycModalVariant('waiting-on-provider')).toBe('default')
    })
})
