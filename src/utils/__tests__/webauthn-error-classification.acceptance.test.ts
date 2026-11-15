import { classifyPasskeyError } from '@/utils/webauthn.utils'

describe('native passkey error classification contract', () => {
    it.each([
        Object.assign(new Error('no discoverable credentials'), { code: 'NotFoundError' }),
        Object.assign(new Error('no discoverable credentials'), { data: { name: 'NotFoundError' } }),
        new DOMException('no discoverable credentials', 'NotFoundError'),
    ])('classifies missing credential through native and DOM error channels', (error) => {
        expect(classifyPasskeyError(error)).toMatchObject({ code: 'PASSKEY_NOT_FOUND', message: expect.any(String) })
    })

    it.each([
        Object.assign(new Error('user dismissed'), { code: 'NotAllowedError' }),
        Object.assign(new Error('user dismissed'), { data: { name: 'NotAllowedError' } }),
        new DOMException('user dismissed', 'NotAllowedError'),
    ])('preserves actual user cancellation through native and DOM channels', (error) => {
        expect(classifyPasskeyError(error)).toMatchObject({ code: 'LOGIN_CANCELED', message: expect.any(String) })
    })
})

describe('plugin messages that reach the fallback (TASK-24017)', () => {
    it.each([
        ['Request timed out', 'NETWORK'],
        [
            'Https exception: java.net.SocketTimeoutException: Read timed out,url=https://peanut.me/.well-known/assetlinks.json',
            'NETWORK',
        ],
        ['[50156] Cannot find credential in local KeyStore or database.', 'PASSKEY_NOT_FOUND'],
        ['User canceled the request', 'LOGIN_CANCELED'],
        ['No create options available.', 'PASSKEY_UNSUPPORTED'],
        ['Unsuccessful result from folsom activity.', 'PASSKEY_INTERRUPTED'],
        ['Passkey registration failed.', 'LOGIN_ERROR'],
    ])('classifies %s', (message, code) => {
        expect(classifyPasskeyError(new Error(message))).toMatchObject({ code, message: expect.any(String) })
    })
})
