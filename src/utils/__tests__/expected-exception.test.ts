import { isExpectedExceptionChain } from '../expected-exception'

test.each([
    '[16] Canceled on BiometricPromptFragment.',
    '[16] Cancelled by user.',
    'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)',
    'User canceled the request',
    'No matching passkey was found.',
])('classifies expected passkey outcomes: %s', (value) => {
    expect(isExpectedExceptionChain([{ type: 'Error', value }])).toBe(true)
})

test.each([
    { type: 'NotAllowedError', value: 'Permission denied' },
    { type: 'AbortError', value: 'The operation was aborted' },
    { type: 'MethodNotFoundRpcError', value: 'Invalid sponsorship request' },
    { type: 'Error', value: 'Minified React error #418' },
    { type: 'Error', value: 'AuthenticationServices.AuthorizationError error 1004' },
    { type: 'Error', value: '[16] Cancelled by user. Then the device failed' },
])('retains defects and ambiguous failures: $type $value', (exception) => {
    expect(isExpectedExceptionChain([exception])).toBe(false)
})

test('drops a known rethrow wrapper but retains a mixed cancellation and defect chain', () => {
    expect(
        isExpectedExceptionChain([
            { type: 'TypeError', value: 'Failed to fetch' },
            { type: 'ServiceUnavailableError', value: 'Something went wrong' },
        ])
    ).toBe(true)
    expect(
        isExpectedExceptionChain([
            { type: 'Error', value: 'User canceled the request' },
            { type: 'TypeError', value: 'Cannot read properties of undefined' },
        ])
    ).toBe(false)
})
