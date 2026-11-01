/** Fix E: frozen spec-only account report authority and unmapped-account enrollment. */
import type { FeatureReport, FeatureReportEntry } from '@/types/capabilities'
import { accountEntry, reportEntry } from '../report'

const READY: FeatureReportEntry = { state: 'ready', action: 'activate' }
const report = (state: 'on' | 'ready', usd: FeatureReportEntry = READY): FeatureReport => ({
    qr: { state: 'on' },
    card: READY,
    local: { ...READY, accounts: { ARS: READY, BRL: READY } },
    bank: { state, accounts: { USD: usd, EUR: { state: 'on' }, GBP: READY, MXN: READY } },
})

describe.each(['on', 'ready'] as const)('aggregate bank %s', (state) => {
    it.each(['deposit', 'withdraw'] as const)('COP %s requires enrollment rather than aggregate bank access', (op) => {
        expect(reportEntry(report(state), op, { channel: 'bank', country: 'CO', method: 'BANK_TRANSFER_CO' })).toEqual(
            expect.objectContaining({ state: 'action_required', action: 'verify' })
        )
    })

    it.each(['deposit', 'withdraw'] as const)('an unmapped rail %s requires enrollment', (op) => {
        expect(reportEntry(report(state), op, { railId: 'bridge.unsupported_bank_rail' })).toEqual(
            expect.objectContaining({ state: 'action_required', action: 'verify' })
        )
    })

    it.each([
        { state: 'on' },
        { state: 'ready', action: 'activate' },
        { state: 'pending' },
        { state: 'setting_up', action: 'wait', since: '2026-10-30' },
        { state: 'action_required', action: 'sumsub:proof_of_address' },
        { state: 'refused', reason: 'document_country_unsupported', action: 'restart-identity' },
    ] as FeatureReportEntry[])('preserves the known USD entry exactly: $state', (usd) => {
        const current = report(state, usd)
        expect(reportEntry(current, 'deposit', { channel: 'bank', country: 'US' })).toEqual(usd)
        expect(reportEntry(current, 'withdraw', { railId: 'bridge.ach_us' })).toEqual(usd)
        expect(accountEntry(current, 'bank', 'USD')).toEqual(usd)
    })
})
