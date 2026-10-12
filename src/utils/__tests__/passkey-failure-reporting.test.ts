jest.mock('@sentry/nextjs', () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }))
let report: typeof import('../passkey-failure-reporting').reportPasskeyFailure
beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    jest.useFakeTimers().setSystemTime(1_000_000)
    report = require('../passkey-failure-reporting').reportPasskeyFailure
})
afterEach(() => jest.useRealTimers())
const error = (message: string) => Object.assign(new Error(message), { name: 'NotAllowedError' })
const association = () =>
    error(
        'The operation couldn’t be completed. Unable to verify webcredentials association of TEAM.app with domain peanut.me. Please try again in a few seconds.'
    )

it.each([
    '(com.apple.AuthenticationServices.AuthorizationError error 1001.)',
    'The operation couldn’t be completed. Device must be unlocked to perform request.',
    'The operation couldn’t be completed. Stolen Device Protection is enabled and biometry is required.',
])('keeps expected %s out of exception reporting', (message) => {
    expect(report(error(message), 'login')).toBe(true)
    // The fresh module uses the mocked SDK instance from after resetModules.
    expect(require('@sentry/nextjs').captureException).not.toHaveBeenCalled()
    expect(require('@sentry/nextjs').addBreadcrumb).toHaveBeenCalledTimes(1)
})

it('reports an association failure once per operation/reason window while retaining attempt breadcrumbs', () => {
    const sdk = require('@sentry/nextjs') as typeof import('@sentry/nextjs')
    const first = association()
    report(first, 'login')
    report(first, 'login')
    report(association(), 'login')
    expect(sdk.captureException).toHaveBeenCalledTimes(1)
    expect(sdk.addBreadcrumb).toHaveBeenCalledTimes(2)
    expect(sdk.captureException).toHaveBeenLastCalledWith(
        first,
        expect.objectContaining({
            level: 'error',
            fingerprint: ['passkey-failure', 'login', 'association_unavailable'],
        })
    )
    report(association(), 'registration')
    expect(sdk.captureException).toHaveBeenCalledTimes(2)
    jest.advanceTimersByTime(5 * 60_000)
    report(association(), 'login')
    expect(sdk.captureException).toHaveBeenCalledTimes(3)
})

it('preserves a bounded diagnostic for an ambiguous NotAllowedError', () => {
    report(error('The request was not allowed'), 'sign-user-op')
    expect(require('@sentry/nextjs').captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
            level: 'warning',
            tags: expect.objectContaining({ passkey_reason: 'not_completed' }),
        })
    )
})

it('leaves unknown technical errors to the original owner', () => {
    expect(report(new Error('sponsor response invalid'), 'sign-user-op')).toBe(false)
    expect(require('@sentry/nextjs').captureException).not.toHaveBeenCalled()
})
