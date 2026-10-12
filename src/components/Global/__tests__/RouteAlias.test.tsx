/** @jest-environment jsdom */
/**
 * Retired profile routes still arrive from outside the app — push and email
 * deep links already delivered, bookmarks, native builds — so each one lands
 * on the page that replaced it, query and all.
 */
import { render } from '@testing-library/react'
import type { ComponentType } from 'react'
import AccountsAndPaymentsAlias from '@/app/(mobile-ui)/profile/accounts-and-payments/page'
import AccountsAndPaymentsAdditionalAlias from '@/app/(mobile-ui)/profile/accounts-and-payments/additional/page'
import IdentityVerificationAlias from '@/app/(mobile-ui)/profile/identity-verification/page'
import IdentityVerificationAdditionalAlias from '@/app/(mobile-ui)/profile/identity-verification/additional/page'

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}))
// the page loader is a lottie; only the redirect is under test
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => null }))

describe('retired profile routes', () => {
    beforeEach(() => mockReplace.mockClear())

    it.each<[string, ComponentType, string, string]>([
        // the card recovery and add money residence links
        ['/profile/accounts-and-payments', AccountsAndPaymentsAlias, '?open=residence', '/profile/accounts'],
        [
            '/profile/accounts-and-payments/additional',
            AccountsAndPaymentsAdditionalAlias,
            '',
            '/profile/accounts/additional',
        ],
        // the backend's KYC push and email deep links
        [
            '/profile/identity-verification',
            IdentityVerificationAlias,
            '?step=resubmit&provider=bridge',
            '/profile/accounts',
        ],
        [
            '/profile/identity-verification/additional',
            IdentityVerificationAdditionalAlias,
            '',
            '/profile/accounts/additional',
        ],
    ])('%s lands on its replacement with the query kept', (path, Alias, query, target) => {
        window.history.replaceState(null, '', `${path}${query}`)
        render(<Alias />)
        expect(mockReplace).toHaveBeenCalledTimes(1)
        expect(mockReplace).toHaveBeenCalledWith(`${target}${query}`)
    })
})
