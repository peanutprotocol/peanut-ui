import { renderHook } from '@testing-library/react'

const mockIsFeatureEnabled = jest.fn()

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        isFeatureEnabled: (key: string) => mockIsFeatureEnabled(key),
        onFeatureFlags: () => () => {},
    },
}))
// Local, preview, staging and the Nutcracker sandbox all read as non-prod.
jest.mock('@/constants/general.consts', () => ({
    ...jest.requireActual('@/constants/general.consts'),
    BASE_URL: 'http://localhost:3050',
}))

import { useDepositAccountsEnabled } from '../useDepositAccountsEnabled'

describe('useDepositAccountsEnabled outside production', () => {
    it('is on with the flag off, so staging and the harness reach the feature', () => {
        mockIsFeatureEnabled.mockReturnValue(false)
        expect(renderHook(() => useDepositAccountsEnabled()).result.current).toBe(true)
        expect(mockIsFeatureEnabled).not.toHaveBeenCalled()
    })
})
