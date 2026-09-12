import { renderHook } from '@testing-library/react'

const mockIsFeatureEnabled = jest.fn()

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        isFeatureEnabled: (key: string) => mockIsFeatureEnabled(key),
        onFeatureFlags: () => () => {},
    },
}))
// `featureFlag.utils` reads BASE_URL once at import, so the domain is fixed per
// test file. This file is the production domain; the non-prod half of the gate
// lives in useDepositAccountsEnabled.nonprod.test.tsx.
jest.mock('@/constants/general.consts', () => ({
    ...jest.requireActual('@/constants/general.consts'),
    BASE_URL: 'https://peanut.me',
}))

import { useDepositAccountsEnabled } from '../useDepositAccountsEnabled'

describe('useDepositAccountsEnabled on the production domain', () => {
    beforeEach(() => mockIsFeatureEnabled.mockReset())

    it('is off while the flag is off', () => {
        mockIsFeatureEnabled.mockReturnValue(false)
        expect(renderHook(() => useDepositAccountsEnabled()).result.current).toBe(false)
    })

    it('fails closed while PostHog has no answer', () => {
        mockIsFeatureEnabled.mockReturnValue(undefined)
        expect(renderHook(() => useDepositAccountsEnabled()).result.current).toBe(false)
    })

    it('is on once the flag is on', () => {
        mockIsFeatureEnabled.mockReturnValue(true)
        expect(renderHook(() => useDepositAccountsEnabled()).result.current).toBe(true)
    })
})
