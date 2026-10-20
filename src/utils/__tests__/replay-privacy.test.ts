import {
    SESSION_RECORDING_PRIVACY,
    maskReplayAttribute,
    maskReplayNetworkRequest,
    maskReplayText,
} from '../replay-privacy'

describe('SESSION_RECORDING_PRIVACY', () => {
    it('masks inputs and text, blocks picked images, and records no network bodies or headers', () => {
        expect(SESSION_RECORDING_PRIVACY).toMatchObject({
            maskAllInputs: true,
            maskTextSelector: '*',
            recordBody: false,
            recordHeaders: false,
        })
        expect(SESSION_RECORDING_PRIVACY.blockSelector).toContain('img[src^="blob:"]')
        expect(SESSION_RECORDING_PRIVACY.blockSelector).toContain('input[type="file"]')
        expect(SESSION_RECORDING_PRIVACY.maskTextFn?.('Balance $1,234.56')).toBe('Balance $*,***.**')
        expect(SESSION_RECORDING_PRIVACY.maskAttributeFn?.('aria-label', 'Send 50 USD')).toBe('Send ** USD')
        expect(SESSION_RECORDING_PRIVACY.maskCapturedNetworkRequestFn).toBe(maskReplayNetworkRequest)
    })
})

describe('maskReplayText', () => {
    it.each([
        ['$1,234.56', '$*,***.**'],
        ['R$ 50,00', 'R$ **,**'],
        ['CPF 123.456.789-09', 'CPF ***.***.***-**'],
        ['DNI 30123456', 'DNI ********'],
        ['•••• 4242', '•••• ****'],
        ['0x7a3F9c21bE04d5', '****************'],
    ])('masks %s', (input, expected) => {
        expect(maskReplayText(input)).toBe(expected)
    })

    it.each(['Add money', 'Withdraw', 'Home', 'Verify your identity'])('keeps navigation text %s', (label) => {
        expect(maskReplayText(label)).toBe(label)
    })
})

describe('maskReplayAttribute', () => {
    it('keeps layout attributes, so the replay still renders', () => {
        expect(maskReplayAttribute('class', 'p-4 gap-2 text-body-m')).toBe('p-4 gap-2 text-body-m')
        expect(maskReplayAttribute('style', 'width: 160px')).toBe('width: 160px')
    })

    it('masks values in text-bearing attributes and still redacts QR data', () => {
        expect(maskReplayAttribute('value', '1500')).toBe('****')
        expect(maskReplayAttribute('href', '/request/0x7a3F9c21bE04d5?amount=20')).toBe(
            '/request/****************?amount=**'
        )
        expect(maskReplayAttribute('data-url', '/qr-pay?qrCode=secret')).toBe('[REDACTED QR DATA]')
    })
})

describe('maskReplayNetworkRequest', () => {
    const timing = { duration: 2, entryType: 'resource', startTime: 1 }

    it('drops bodies, headers, query values and fragments, and keeps the path', () => {
        expect(
            maskReplayNetworkRequest({
                ...timing,
                name: 'https://api.peanut.me/users/me/history?limit=20&to=0xabc#frag',
                method: 'GET',
                status: 200,
                requestBody: '{"amount":"50"}',
                responseBody: '{"balance":"1234"}',
                requestHeaders: { authorization: 'Bearer secret' },
                responseHeaders: { 'set-cookie': 'secret' },
            })
        ).toEqual({
            ...timing,
            name: 'https://api.peanut.me/users/me/history?limit=&to=',
            method: 'GET',
            status: 200,
        })
    })

    it('keeps the QR redaction', () => {
        expect(maskReplayNetworkRequest({ ...timing, name: '/qr-pay?qrCode=secret' }).name).toBe('[REDACTED QR DATA]')
    })
})
