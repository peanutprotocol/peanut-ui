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
