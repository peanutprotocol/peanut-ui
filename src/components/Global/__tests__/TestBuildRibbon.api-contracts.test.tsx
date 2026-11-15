import { act, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { TestBuildRibbon } from '../TestBuildRibbon'
import { getApiCompatibility, loadApiVersion, subscribeApiCompatibility } from '@/utils/api-contracts'

jest.mock('@/utils/api-contracts', () => ({
    getApiCompatibility: jest.fn(),
    loadApiVersion: jest.fn(),
    subscribeApiCompatibility: jest.fn(() => () => {}),
}))
jest.mock('react-fast-marquee', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH = 'kyc-test'
})
afterEach(() => {
    delete process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH
})

it.each([
    ['compatible', 3, false, 'API e7a93bf · kyc v3', false],
    ['incompatible', 2, false, 'API too old for this build', true],
    ['compatible', 3, true, 'API contract error', true],
    ['unknown', undefined, false, 'API version unavailable', false],
    ['loading', undefined, false, 'API version loading', false],
] as const)('shows the named %s / contract fault %s state', (status, kyc, contractError, label, red) => {
    jest.mocked(getApiCompatibility).mockReturnValue({
        status,
        contractError,
        version:
            kyc === undefined
                ? null
                : { commit: 'e7a93bf7d', branch: null, builtAt: null, migrationsHead: null, contracts: { kyc } },
    })
    renderWithIntl(<TestBuildRibbon />)
    expect(screen.getByTestId('test-build-ribbon')).toHaveTextContent(label)
    expect(screen.getByTestId('test-build-ribbon').querySelector('.bg-red-600') !== null).toBe(red)
    expect(loadApiVersion).toHaveBeenCalledTimes(1)
})

it('subscribes to late contract failures', () => {
    let notify!: () => void
    jest.mocked(subscribeApiCompatibility).mockImplementation((listener) => {
        notify = listener
        return () => {}
    })
    jest.mocked(getApiCompatibility).mockReturnValue({ status: 'loading', version: null, contractError: false })
    renderWithIntl(<TestBuildRibbon />)
    act(() => {
        jest.mocked(getApiCompatibility).mockReturnValue({ status: 'loading', version: null, contractError: true })
        notify()
    })
    expect(screen.getByTestId('test-build-ribbon')).toHaveTextContent('API contract error')
    expect(screen.getByTestId('test-build-ribbon').querySelector('.bg-red-600')).not.toBeNull()
})

it('starts the nonblocking check on production without displaying UI', () => {
    delete process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH
    jest.mocked(getApiCompatibility).mockReturnValue({ status: 'incompatible', version: null, contractError: false })
    renderWithIntl(<TestBuildRibbon />)
    expect(screen.queryByTestId('test-build-ribbon')).toBeNull()
    expect(loadApiVersion).toHaveBeenCalledTimes(1)
})
