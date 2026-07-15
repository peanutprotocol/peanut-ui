import {
    deriveGate,
    getGateAdvisory,
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

    test('requires-info rail with no surfaced action -> fixable-rejection, NOT cross-region needs-enrollment (government-id self-heal loop)', () => {
        // Reported loop: a Bridge rail that needs a government-id re-upload
        // (DOCUMENT_SELF_HEAL) carries no blockingAction because the backend resolver
        // punts it to the FE resubmit endpoint. It must route to the self-heal /
        // document flow, NOT the misleading "Unlock {region}" cross-region modal
        // (needs-enrollment) that looped users on a fake "You're unlocked".
        const rail = bankRail({
            id: 'bridge.ach_us',
            status: 'requires-info',
            blockingActions: [],
        })
        const gate = deriveGate(state([rail], []), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('fixable-rejection')
    })

    test('mixed scope: 7b surfaces the self-heal rail reason, not a wait-only rail message', () => {
        // A wait-only rail ("finalizing with Bridge") + an action-less self-heal rail
        // in the same scope. allWaiting is false, so 7b fires — it must pick the
        // self-heal rail's reason for the Upload-document modal, not the wait message.
        const waitAction: NextAction = { key: 'wait:bridge', kind: 'wait', purpose: 'bridge-review' }
        const rails = [
            bankRail({
                id: 'bridge.sepa_eu',
                status: 'requires-info',
                blockingActions: ['wait:bridge'],
                reason: { code: 'bridge_processing', userMessage: "We're finalizing your verification with Bridge." },
            }),
            bankRail({
                id: 'bridge.ach_us',
                status: 'requires-info',
                blockingActions: [],
                reason: { code: 'document_rejected', userMessage: 'Please re-upload your ID document.' },
            }),
        ]
        const gate = deriveGate(state(rails, [waitAction]), 'deposit', { channel: 'bank' })
        expect(gate).toMatchObject({ kind: 'fixable-rejection', userMessage: 'Please re-upload your ID document.' })
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

describe('deriveGate — restart-identity vs contact-support split for blocked rails', () => {
    const restartAction: NextAction = {
        key: 'restart-identity',
        kind: 'restart-identity',
        purpose: 'verify-with-different-document',
    }
    const supportAction: NextAction = { key: 'contact-support', kind: 'contact-support', purpose: 'kyc-support' }

    test('blocked rail carrying restart-identity action → restart-identity gate (self-fix path)', () => {
        const rail = bankRail({
            id: 'manteca.bank_transfer_ar',
            provider: 'manteca',
            method: 'BANK_TRANSFER_AR',
            country: 'AR',
            currency: 'ARS',
            status: 'blocked',
            blockingActions: ['restart-identity'],
            reason: {
                code: 'country_not_supported',
                userMessage: 'This rail only supports documents issued in Argentina or Brazil.',
            },
        })

        const gate = deriveGate(state([rail], [restartAction]), 'deposit', { channel: 'bank' })

        expect(gate.kind).toBe('restart-identity')
        if (gate.kind === 'restart-identity') {
            expect(gate.userMessage).toMatch(/Argentina or Brazil/)
            expect(gate.reason?.code).toBe('country_not_supported')
        }
        expect(getKycModalVariant(gate.kind)).toBe('restart_identity')
        expect(getGateUserMessage(gate)).toMatch(/Argentina or Brazil/)
    })

    test('blocked rail with only contact-support → blocked-rejection (terminal)', () => {
        const rail = bankRail({
            status: 'blocked',
            blockingActions: ['contact-support'],
            reason: {
                code: 'country_not_supported',
                userMessage: 'This rail is not available in Cuba yet.',
            },
        })

        const gate = deriveGate(state([rail], [supportAction]), 'deposit', { channel: 'bank' })

        expect(gate.kind).toBe('blocked-rejection')
        expect(getKycModalVariant(gate.kind)).toBe('blocked')
    })
})

describe('deriveGate — ready-first ordering (Alexandre fix)', () => {
    const tosAction: NextAction = { key: 'bridge.tos', kind: 'accept-tos', purpose: 'bridge-tos' }
    const sumsubAction: NextAction = { key: 'bridge.rfi', kind: 'sumsub', purpose: 'bridge-rfi' }

    test('Alexandre case: PIX_BR ENABLED + Bridge × US/GB/EU/MX stuck on ToS → ready (no modal)', () => {
        const pixBr = bankRail({
            id: 'manteca.pix_br',
            provider: 'manteca',
            method: 'PIX_BR',
            country: 'BR',
            currency: 'BRL',
            status: 'enabled',
        })
        const stuck = (id: `bridge.${string}`, country: string, currency: string, method: string): RailCapability =>
            bankRail({
                id,
                provider: 'bridge',
                method,
                country,
                currency,
                status: 'requires-info',
                blockingActions: ['bridge.tos'],
                reason: { code: 'bridge_tos_v2_required', userMessage: 'Accept terms' },
            })
        const rails = [
            pixBr,
            stuck('bridge.ach_us', 'US', 'USD', 'ACH_US'),
            stuck('bridge.faster_payments_gb', 'GB', 'GBP', 'FASTER_PAYMENTS_GB'),
            stuck('bridge.sepa_eu', 'EU', 'EUR', 'SEPA_EU'),
            stuck('bridge.spei_mx', 'MX', 'MXN', 'SPEI_MX'),
        ]

        const gate = deriveGate(state(rails, [tosAction]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('ready')
    })

    test('ready beats blocked-rejection — working rail trumps unrelated blocked one', () => {
        const ready = bankRail({ id: 'manteca.pix_br', provider: 'manteca', country: 'BR', status: 'enabled' })
        const blockedTerminal = bankRail({
            id: 'bridge.ach_us',
            status: 'blocked',
            reason: { code: 'kyc_rejected_terminal', userMessage: 'Verification failed' },
        })

        const gate = deriveGate(state([ready, blockedTerminal]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('ready')
    })

    test('ready beats fixable-rejection — RFI on another rail does not gate', () => {
        const ready = bankRail({ id: 'manteca.pix_br', provider: 'manteca', country: 'BR', status: 'enabled' })
        const rfi = bankRail({ id: 'bridge.ach_us', status: 'requires-info', blockingActions: ['bridge.rfi'] })

        const gate = deriveGate(state([ready, rfi], [sumsubAction]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('ready')
    })

    test('ready beats restart-identity — self-fixable blocked rail does not gate', () => {
        const ready = bankRail({ id: 'manteca.pix_br', provider: 'manteca', country: 'BR', status: 'enabled' })
        const restartable = bankRail({
            id: 'bridge.ach_us',
            status: 'blocked',
            blockingActions: ['bridge.restart'],
        })
        const restartAction: NextAction = { key: 'bridge.restart', kind: 'restart-identity', purpose: 'restart' }

        const gate = deriveGate(state([ready, restartable], [restartAction]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('ready')
    })

    test('no ready rail → falls through to existing blocked / accept-tos / fixable order', () => {
        const tosRail = bankRail({
            id: 'bridge.ach_us',
            status: 'requires-info',
            blockingActions: ['bridge.tos'],
            reason: { code: 'bridge_tos_required', userMessage: 'Accept terms' },
        })

        const gate = deriveGate(state([tosRail], [tosAction]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('accept-tos')
    })

    test('per-op enabled status (not rail-level) is what matters', () => {
        const railWithEnabledOp = bankRail({
            id: 'bridge.ach_us',
            status: 'requires-info',
            operations: { deposit: 'enabled', withdraw: 'requires-info' },
            blockingActions: ['bridge.rfi'],
        })

        const gate = deriveGate(state([railWithEnabledOp], [sumsubAction]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('ready')
    })
})

describe('deriveGate — country scoping (the Add Money dead-end class)', () => {
    // AddWithdrawCountriesList (Add Money → Bank list) regressed by reading raw
    // `bankRails()` UNSCOPED to decide whether to open an "under review" modal,
    // AFTER this gate had already returned `ready`. These tests pin the
    // gate-level invariant the component must rely on instead: a pending
    // sibling rail — in ANY country, including the user's own — never downgrades
    // a scoped `ready`. The gate is the single source of truth; there is
    // nothing left for a consumer to re-check.

    test('cross-jurisdiction: enabled US rail + pending EU rail, scoped to US → ready', () => {
        const rails = [
            bankRail({ id: 'bridge.ach_us', country: 'US', status: 'enabled' }),
            bankRail({ id: 'bridge.sepa_eu', method: 'SEPA_EU', country: 'EU', currency: 'EUR', status: 'pending' }),
        ]
        expect(deriveGate(state(rails), 'deposit', { channel: 'bank', country: 'US' }).kind).toBe('ready')
    })

    test('same-country: enabled + pending in the SAME country → ready (the case country-scoping alone could not fix)', () => {
        // Both rails share the country, so narrowing `bankRails({country})` would
        // STILL see the pending one. The gate is correct anyway: `ready` outranks
        // `pending`. This is why the fix removed the extra check entirely.
        const rails = [
            bankRail({
                id: 'manteca.bank_transfer_ar',
                provider: 'manteca',
                method: 'BANK_TRANSFER_AR',
                country: 'AR',
                currency: 'ARS',
                status: 'enabled',
            }),
            bankRail({
                id: 'bridge.bank_transfer_ar',
                provider: 'bridge',
                method: 'BANK_TRANSFER_AR',
                country: 'AR',
                currency: 'ARS',
                status: 'pending',
            }),
        ]
        expect(deriveGate(state(rails), 'deposit', { channel: 'bank', country: 'AR' }).kind).toBe('ready')
    })

    test('verified user, no rail in the requested jurisdiction → needs-enrollment (the "Unlock Bulgaria" class)', () => {
        // The cross_region "Unlock <region>" modal is the CORRECT gate output:
        // identity verified, but no bank rail in the scoped country yet. (The
        // prod Bulgaria bug was downstream — the BE cross-region enroll ignored
        // the FE's 4-bucket regionIntent='EU'. The gate classification is right;
        // a fix belongs in the enrollment path, not here.)
        const rails = [
            bankRail({
                id: 'manteca.pix_br',
                provider: 'manteca',
                method: 'PIX_BR',
                country: 'BR',
                currency: 'BRL',
                status: 'enabled',
            }),
        ]
        const gate = deriveGate(state(rails, [], /* identityVerified */ true), 'deposit', {
            channel: 'bank',
            country: 'EU',
        })
        expect(gate.kind).toBe('needs-enrollment')
    })
})

describe('deriveGate — advisory pre-empt (future-dated requirement on a ready rail)', () => {
    // A Bridge rail that's ENABLED now but carries a future-dated requirement,
    // surfaced by the BE as a non-blocking hintAction whose NextAction has an
    // `effectiveDate` (the 2026-06-29 sof_individual_primary_purpose cohort).
    const advisoryAction: NextAction = {
        key: 'sumsub:eea_uplift',
        kind: 'sumsub',
        purpose: 'unlock-bridge',
        levelKey: 'eea_uplift',
        effectiveDate: '2099-06-29',
        requirementKey: 'sof_individual_primary_purpose',
    }

    test('enabled rail with a future-dated hint → ready + advisory (rail stays usable)', () => {
        const rail = bankRail({
            id: 'bridge.sepa_eu',
            method: 'SEPA_EU',
            country: 'EU',
            currency: 'EUR',
            status: 'enabled',
            hintActions: ['sumsub:eea_uplift'],
        })
        const gate = deriveGate(state([rail], [advisoryAction]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('ready')
        if (gate.kind === 'ready') {
            expect(gate.advisory).toEqual({
                effectiveDate: '2099-06-29',
                actionKey: 'sumsub:eea_uplift',
                requirementKey: 'sof_individual_primary_purpose',
            })
        }
        expect(getGateAdvisory(gate)).toMatchObject({ effectiveDate: '2099-06-29', actionKey: 'sumsub:eea_uplift' })
    })

    test('enabled rail with no hint → ready, no advisory (back-compat)', () => {
        const gate = deriveGate(state([bankRail({ status: 'enabled' })]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('ready')
        if (gate.kind === 'ready') expect(gate.advisory).toBeUndefined()
        expect(getGateAdvisory(gate)).toBeUndefined()
    })

    test('a hint WITHOUT effectiveDate (Manteca cap-nudge) is not an advisory pre-empt', () => {
        const capNudge: NextAction = {
            key: 'sumsub:source_of_funds',
            kind: 'sumsub',
            purpose: 'raise-manteca-limit',
            levelKey: 'source_of_funds',
        }
        const rail = bankRail({
            id: 'manteca.pix_br',
            provider: 'manteca',
            method: 'PIX_BR',
            country: 'BR',
            currency: 'BRL',
            status: 'enabled',
            hintActions: ['sumsub:source_of_funds'],
        })
        const gate = deriveGate(state([rail], [capNudge]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('ready')
        if (gate.kind === 'ready') expect(gate.advisory).toBeUndefined()
    })

    test('earliest effectiveDate wins across multiple ready rails', () => {
        const later: NextAction = {
            key: 'sumsub:tax_identification_number',
            kind: 'sumsub',
            purpose: 'unlock-bridge',
            levelKey: 'tax_identification_number',
            effectiveDate: '2099-12-31',
        }
        const rails = [
            bankRail({
                id: 'bridge.sepa_eu',
                method: 'SEPA_EU',
                country: 'EU',
                currency: 'EUR',
                status: 'enabled',
                hintActions: ['sumsub:tax_identification_number'],
            }),
            bankRail({ id: 'bridge.ach_us', status: 'enabled', hintActions: ['sumsub:eea_uplift'] }),
        ]
        const gate = deriveGate(state(rails, [advisoryAction, later]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('ready')
        if (gate.kind === 'ready') expect(gate.advisory?.effectiveDate).toBe('2099-06-29')
    })

    test('a blocking sibling still wins — advisory only rides on an otherwise-ready scope', () => {
        // If the same scope has a CURRENT blocker, that takes priority (ready
        // requires an enabled rail); advisory is strictly a ready-state rider.
        const blockedRail = bankRail({
            id: 'bridge.sepa_eu',
            method: 'SEPA_EU',
            country: 'EU',
            currency: 'EUR',
            status: 'requires-info',
            blockingActions: ['sumsub:eea_uplift'],
        })
        const gate = deriveGate(state([blockedRail], [advisoryAction]), 'deposit', { channel: 'bank' })
        expect(gate.kind).toBe('fixable-rejection')
    })
})

describe('deriveGate — provide-email self-serve for email-blocked rails', () => {
    const provideEmailAction: NextAction = {
        key: 'provide-email',
        kind: 'provide-email',
        purpose: 'submission-failed-no-email',
    }

    test('blocked rail carrying provide-email action → provide-email gate (self-fix path)', () => {
        const rail = bankRail({
            status: 'blocked',
            blockingActions: ['provide-email'],
            reason: {
                code: 'email_required',
                userMessage: 'We need an email address to finish setting up this account.',
            },
        })

        const gate = deriveGate(state([rail], [provideEmailAction]), 'deposit', { channel: 'bank' })

        expect(gate.kind).toBe('provide-email')
        if (gate.kind === 'provide-email') {
            expect(gate.userMessage).toMatch(/email address/)
            expect(gate.reason?.code).toBe('email_required')
        }
        expect(getGateUserMessage(gate)).toMatch(/email address/)
    })

    test('blocked rail without provide-email action still dead-ends on blocked-rejection', () => {
        const rail = bankRail({
            status: 'blocked',
            blockingActions: ['contact-support'],
            reason: { code: 'submission_failed', userMessage: 'We hit a snag.' },
        })
        const supportAction: NextAction = { key: 'contact-support', kind: 'contact-support', purpose: 'kyc-support' }

        const gate = deriveGate(state([rail], [supportAction]), 'deposit', { channel: 'bank' })

        expect(gate.kind).toBe('blocked-rejection')
    })
})

describe('deriveGate — resolved verdict is authoritative (BE step 3)', () => {
    // When the BE ships `rail.resolved`, the gate renders IT — even when the
    // legacy status/actions would derive something else. These pin the verdict
    // as the single source of truth; the legacy paths above only cover rails
    // without `resolved` (older BE / cached responses).

    test('resolved fixable wins over a legacy blocked status', () => {
        const gate = deriveGate(
            state([
                bankRail({
                    status: 'blocked',
                    reason: { code: 'document_rejected', userMessage: 'legacy message' },
                    resolved: {
                        status: 'fixable',
                        blocking: {
                            code: 'document_rejected',
                            userMessage: 'verdict message',
                            selfHealable: true,
                            selfHealKind: 'document-resubmit',
                        },
                    },
                }),
            ]),
            'deposit'
        )
        expect(gate.kind).toBe('fixable-rejection')
        expect(getGateUserMessage(gate)).toBe('verdict message')
    })

    test('resolved blocked wins over a legacy requires-info status', () => {
        const gate = deriveGate(
            state([
                bankRail({
                    status: 'requires-info',
                    resolved: {
                        status: 'blocked',
                        blocking: { code: 'verification_blocked', userMessage: 'terminal', selfHealable: false },
                    },
                }),
            ]),
            'deposit'
        )
        expect(gate.kind).toBe('blocked-rejection')
    })

    test('resolved provide-email verdict → provide-email gate without action lookups', () => {
        const gate = deriveGate(
            state([
                bankRail({
                    status: 'blocked',
                    resolved: {
                        status: 'fixable',
                        blocking: {
                            code: 'email_required',
                            userMessage: 'add an email',
                            selfHealable: true,
                            selfHealKind: 'provide-email',
                        },
                    },
                }),
            ]),
            'deposit'
        )
        expect(gate.kind).toBe('provide-email')
    })

    test('resolved accept-tos rides the verdict nextAction (tosUrl included)', () => {
        const gate = deriveGate(
            state([
                bankRail({
                    status: 'requires-info',
                    resolved: {
                        status: 'fixable',
                        blocking: { code: 'bridge_tos_required', userMessage: 'accept ToS', selfHealable: true },
                        nextAction: {
                            key: 'accept-tos:bridge',
                            kind: 'accept-tos',
                            purpose: 'bridge-tos',
                            tosUrl: 'https://tos.example',
                        },
                    },
                }),
            ]),
            'deposit'
        )
        expect(gate.kind).toBe('accept-tos')
        expect(gate.kind === 'accept-tos' && gate.tosUrl).toBe('https://tos.example')
    })

    test('resolved pending with a wait nextAction → waiting-on-provider', () => {
        const gate = deriveGate(
            state([
                bankRail({
                    status: 'requires-info',
                    reason: { code: 'bridge_processing', userMessage: 'we are checking' },
                    resolved: {
                        status: 'pending',
                        nextAction: { key: 'wait:bridge', kind: 'wait', purpose: 'bridge-review' },
                    },
                }),
            ]),
            'deposit'
        )
        expect(gate.kind).toBe('waiting-on-provider')
        expect(getGateUserMessage(gate)).toBe('we are checking')
    })

    test('resolved advisory nextAction on an enabled rail surfaces the ready advisory', () => {
        const gate = deriveGate(
            state([
                bankRail({
                    status: 'enabled',
                    resolved: {
                        status: 'enabled',
                        nextAction: {
                            key: 'sumsub:sof',
                            kind: 'sumsub',
                            purpose: 'pre-empt',
                            effectiveDate: '2026-08-01',
                            requirementKey: 'sof_individual_primary_purpose',
                        },
                    },
                }),
            ]),
            'deposit'
        )
        expect(gate.kind).toBe('ready')
        expect(getGateAdvisory(gate)).toEqual({
            effectiveDate: '2026-08-01',
            actionKey: 'sumsub:sof',
            requirementKey: 'sof_individual_primary_purpose',
        })
    })

    test('resolved restart-identity selfHealKind → restart-identity gate', () => {
        const gate = deriveGate(
            state([
                bankRail({
                    status: 'blocked',
                    resolved: {
                        status: 'blocked',
                        blocking: {
                            code: 'country_not_supported',
                            userMessage: 'try another document',
                            selfHealable: true,
                            selfHealKind: 'restart-identity',
                        },
                    },
                }),
            ]),
            'deposit'
        )
        expect(gate.kind).toBe('restart-identity')
    })
})

describe('deriveGate — legacy fallback fidelity (code-review regression pins)', () => {
    // Shapes the pre-verdict ladder handled that the 32 legacy tests above
    // never mixed. Each of these was a CONFIRMED review finding: the fallback
    // must key on STATUS first — action kinds only refine within a status.

    const sumsubAction: NextAction = { key: 'sumsub:poa', kind: 'sumsub', purpose: 'rfi', levelKey: 'poa' }
    const tosAction: NextAction = { key: 'accept-tos:bridge', kind: 'accept-tos', purpose: 'tos' }
    const waitAction: NextAction = { key: 'wait:bridge', kind: 'wait', purpose: 'review' }
    const restartAction: NextAction = { key: 'restart', kind: 'restart-identity', purpose: 'restart' }
    const supportAction: NextAction = { key: 'support', kind: 'contact-support', purpose: 'support' }

    test('blocked rail with a stale sumsub action stays blocked-rejection (no resurrected upload CTA)', () => {
        const gate = deriveGate(
            state([bankRail({ status: 'blocked', blockingActions: [sumsubAction.key] })], [sumsubAction]),
            'deposit'
        )
        expect(gate.kind).toBe('blocked-rejection')
    })

    test('blocked rail with a stale accept-tos action stays blocked-rejection', () => {
        const gate = deriveGate(
            state([bankRail({ status: 'blocked', blockingActions: [tosAction.key] })], [tosAction]),
            'deposit'
        )
        expect(gate.kind).toBe('blocked-rejection')
    })

    test('blocked rail with only a wait action stays blocked-rejection (not hidden behind "we are checking")', () => {
        const gate = deriveGate(
            state([bankRail({ status: 'blocked', blockingActions: [waitAction.key] })], [waitAction]),
            'deposit'
        )
        expect(gate.kind).toBe('blocked-rejection')
    })

    test('terminal blocked rail first in scope beats a sibling restart-identity rail', () => {
        const gate = deriveGate(
            state(
                [
                    bankRail({ id: 'bridge.ach_us', status: 'blocked' }),
                    bankRail({
                        id: 'manteca.pix_br',
                        provider: 'manteca',
                        method: 'PIX_BR',
                        country: 'BR',
                        status: 'blocked',
                        blockingActions: [restartAction.key],
                    }),
                ],
                [restartAction]
            ),
            'deposit'
        )
        expect(gate.kind).toBe('blocked-rejection')
    })

    test('pending sibling beats an action-less requires-info rail (old 7b placement)', () => {
        const gate = deriveGate(
            state([
                bankRail({ id: 'bridge.ach_us', status: 'pending' }),
                bankRail({ id: 'bridge.sepa_eu', method: 'SEPA_EU', country: 'EU', status: 'requires-info' }),
            ]),
            'deposit'
        )
        expect(gate.kind).toBe('pending')
    })

    test('requires-info + contact-support-only rail does NOT outrank a fixable sumsub sibling', () => {
        const gate = deriveGate(
            state(
                [
                    bankRail({ id: 'bridge.ach_us', status: 'requires-info', blockingActions: [supportAction.key] }),
                    bankRail({
                        id: 'bridge.sepa_eu',
                        method: 'SEPA_EU',
                        country: 'EU',
                        status: 'requires-info',
                        blockingActions: [sumsubAction.key],
                    }),
                ],
                [supportAction, sumsubAction]
            ),
            'deposit'
        )
        expect(gate.kind).toBe('fixable-rejection')
    })
})
