/**
 * Slava, 2026-10-26: a build for testing says so on every screen; a release
 * shows nothing and leaves the safe area alone.
 */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'

// Layout tests do not request a live API version; the companion contract suite
// controls store updates and verifies the version check and failure indicators.
jest.mock('@/utils/api-contracts', () => ({
    getApiCompatibility: jest.fn().mockReturnValue({ status: 'loading', version: null, contractError: false }),
    loadApiVersion: jest.fn().mockResolvedValue(undefined),
    subscribeApiCompatibility: jest.fn(() => () => {}),
}))

jest.mock('react-fast-marquee', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { TestBuildRibbon } from '../TestBuildRibbon'

afterEach(() => {
    delete process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH
    document.documentElement.style.removeProperty('--safe-top')
})

it('names the branch and makes room for itself under the status bar', () => {
    process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH = 'innolope/kyc-document-selection'
    renderWithIntl(<TestBuildRibbon />)
    expect(screen.getByTestId('test-build-ribbon')).toHaveTextContent(
        'Version for testing: branch innolope/kyc-document-selection'
    )
    expect(document.documentElement.style.getPropertyValue('--safe-top')).toContain('1.75rem')
})

it('shows nothing on a release build', () => {
    process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH = ''
    renderWithIntl(<TestBuildRibbon />)
    expect(screen.queryByTestId('test-build-ribbon')).toBeNull()
    expect(document.documentElement.style.getPropertyValue('--safe-top')).toBe('')
})

it('restores the safe area when the ribbon unmounts', () => {
    process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH = 'feature/test'
    const { unmount } = renderWithIntl(<TestBuildRibbon />)

    expect(document.documentElement.style.getPropertyValue('--safe-top')).toContain('1.75rem')
    unmount()
    expect(document.documentElement.style.getPropertyValue('--safe-top')).toBe('')
})
