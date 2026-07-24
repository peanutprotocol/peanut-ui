import { buildSupportVerificationSummary } from '../support-verification'
import type { IdentityVerification, RailCapability, UserCapabilities } from '@/types/capabilities'

function caps(rails: RailCapability[], nextActions: UserCapabilities['nextActions'] = []): UserCapabilities {
    return { rails, nextActions, restrictions: [] }
}

const enabledRail: RailCapability = {
    id: 'bridge.ach_us',
    provider: 'bridge',
    method: 'ACH_US',
    channel: 'bank',
    country: 'US',
    currency: 'USD',
    status: 'enabled',
    resolved: { status: 'enabled' },
}

const emailBlockedRail: RailCapability = {
    id: 'manteca.pix_br',
    provider: 'manteca',
    method: 'PIX_BR',
    channel: 'bank',
    country: 'BR',
    currency: 'BRL',
    status: 'blocked',
    reason: {
        code: 'no_email_captured',
        userMessage: 'We need your email',
        details: 'No email captured during submission',
    },
    resolved: {
        status: 'fixable',
        blocking: {
            code: 'no_email_captured',
            userMessage: 'We need your email',
            selfHealable: true,
            selfHealKind: 'provide-email',
            details: 'No email captured during submission',
        },
    },
}

describe('buildSupportVerificationSummary', () => {
    test('reports identity status, email-on-file and per-op gates', () => {
        const identity: IdentityVerification = { status: 'verified' }
        const summary = buildSupportVerificationSummary(caps([enabledRail]), identity, 'a@b.com')

        expect(summary.identityStatus).toBe('verified')
        expect(summary.emailOnFile).toBe(true)
        expect(summary.gates).toContain('pay:ready')
    })

    test('surfaces the stuck rail + failure reason', () => {
        const identity: IdentityVerification = { status: 'verified' }
        const summary = buildSupportVerificationSummary(caps([emailBlockedRail]), identity, undefined)

        expect(summary.emailOnFile).toBe(false)
        expect(summary.failureReason).toBe('manteca.pix_br · no_email_captured — No email captured during submission')
        expect(summary.gates).toContain('deposit:provide-email')
        expect(summary.verificationRails).toBe('manteca.pix_br:fixable(no_email_captured)')
    })

    test('names the rail behind a pending/waiting gate that has no failure reason', () => {
        const waitingRail: RailCapability = {
            id: 'manteca.bank_transfer_ar',
            provider: 'manteca',
            method: 'BANK_TRANSFER_AR',
            channel: 'bank',
            country: 'AR',
            currency: 'ARS',
            status: 'pending',
            resolved: { status: 'pending' },
        }
        const summary = buildSupportVerificationSummary(caps([waitingRail]), { status: 'verified' }, 'a@b.com')

        // no failure to report, but the agent must still see WHICH rail is stuck
        expect(summary.failureReason).toBeUndefined()
        expect(summary.verificationRails).toBe('manteca.bank_transfer_ar:pending')
    })

    test('lists pending next-actions as kind(purpose)', () => {
        const summary = buildSupportVerificationSummary(
            caps([emailBlockedRail], [{ key: 'k1', kind: 'provide-email', purpose: 'unlock-manteca-pix' }]),
            { status: 'verified' },
            undefined
        )
        expect(summary.pendingActions).toBe('provide-email(unlock-manteca-pix)')
    })

    test('degrades cleanly with no read-models', () => {
        const summary = buildSupportVerificationSummary(undefined, undefined, undefined)
        expect(summary.identityStatus).toBe('unknown')
        expect(summary.emailOnFile).toBe(false)
        expect(summary.failureReason).toBeUndefined()
        expect(summary.pendingActions).toBeUndefined()
    })

    test('reports action_required identity status', () => {
        const summary = buildSupportVerificationSummary(
            caps([enabledRail]),
            { status: 'action_required', actionMessage: 'Re-upload your document' },
            'a@b.com'
        )
        expect(summary.identityStatus).toBe('action_required')
    })
})
