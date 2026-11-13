import { ApiError } from '@/services/api-error'
import { pixStandingRefusal } from '../pixFlow.utils'

const refused = (status: number, code?: string) => new ApiError('refused', { status, code })

// API-CONTRACT.md section 5: every refusal of POST /pix/deposit for a standing code has its own screen
describe('pixStandingRefusal', () => {
    it('reads the capabilities again when the route moved, whatever the status', () => {
        expect(pixStandingRefusal(refused(403, 'ROUTE_NOT_AVAILABLE'))).toEqual({ screen: 'retry', recheck: true })
        expect(pixStandingRefusal(refused(409, 'ROUTE_NOT_AVAILABLE'))).toEqual({ screen: 'retry', recheck: true })
    })

    it('shows the outage for a paused provider (503), and a retry for a failed one (502)', () => {
        expect(pixStandingRefusal(refused(503, 'PROVIDER_UNAVAILABLE'))).toEqual({ screen: 'paused' })
        expect(pixStandingRefusal(refused(502, 'PROVIDER_UNAVAILABLE'))).toEqual({ screen: 'retry', recheck: false })
    })

    it('offers another try for what clears by itself', () => {
        for (const error of [
            refused(409, 'DEPOSIT_ACCOUNT_CLAIM_IN_FLIGHT'),
            // support, account deletion or a lock wait: the account screens lead with a retry too
            refused(409),
            refused(404),
            refused(429),
            new TypeError('Failed to fetch'),
        ])
            expect(pixStandingRefusal(error)).toEqual({ screen: 'retry', recheck: false })
    })

    it('closes with the reason and support where a tap here changes nothing', () => {
        expect(pixStandingRefusal(refused(403, 'DEPOSIT_ACCOUNTS_NOT_AVAILABLE'))).toEqual({
            screen: 'closed',
            line: 'pix.rolloutClosed',
        })
        for (const code of ['uk_resident_blocked', 'residence_bank_restricted', undefined])
            expect(pixStandingRefusal(refused(403, code))).toEqual({ screen: 'closed', line: 'pix.residenceNotServed' })
        // the Pix account is outside the account limit: a limit refusal that still comes is a closed refusal
        for (const code of ['DEPOSIT_ACCOUNT_PROVIDER_REFUSED', 'DEPOSIT_ACCOUNT_LIMIT'])
            expect(pixStandingRefusal(refused(409, code))).toEqual({
                screen: 'closed',
                line: 'depositAccounts.errors.providerRefused',
            })
    })
})
