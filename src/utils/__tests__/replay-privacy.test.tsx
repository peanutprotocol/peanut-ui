import { render, screen } from '@testing-library/react'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { SavedAccountsMapping } from '@/components/Common/SavedAccountsView'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { AccountType, type Account } from '@/interfaces/interfaces'
import { IntlWrapper } from '@/test-utils/intl'

jest.mock('next/image', () => ({
    __esModule: true,
    // eslint-disable-next-line @next/next/no-img-element
    default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ invitedUsernamesSet: new Set<string>(), user: null }),
}))

import {
    SESSION_RECORDING_PRIVACY,
    maskReplayAttribute,
    maskReplayNetworkRequest,
    maskReplayText,
    maskReplayTextIn,
} from '../replay-privacy'

const maskText = (text: string, element: Element) =>
    SESSION_RECORDING_PRIVACY.maskTextFn?.(text, element as HTMLElement)
const maskAttribute = (name: string, value: string, element?: Element) =>
    SESSION_RECORDING_PRIVACY.maskAttributeFn?.(name, value, element)

describe('SESSION_RECORDING_PRIVACY', () => {
    it('masks inputs and text, blocks picked images, and records no network bodies or headers', () => {
        expect(SESSION_RECORDING_PRIVACY).toMatchObject({
            maskAllInputs: true,
            maskTextSelector: '*',
            recordBody: false,
            recordHeaders: false,
        })
        expect(SESSION_RECORDING_PRIVACY.blockSelector).toContain('img[src^="blob:"]')
        expect(SESSION_RECORDING_PRIVACY.blockSelector).toContain('video')
        expect(SESSION_RECORDING_PRIVACY.blockSelector).toContain('input[type="file"]')
        expect(SESSION_RECORDING_PRIVACY.maskCapturedNetworkRequestFn).toBe(maskReplayNetworkRequest)
    })
})

// Hugo, 2026-10-20: usernames are public pay-link handles, URLs already ride
// on every event in $current_url, and labels make a replay readable.
describe('stays readable', () => {
    it('a Peanut username and @handle, including on the shared user label', () => {
        expect(maskReplayText('Pay @alice')).toBe('Pay @alice')
        render(<VerifiedUserLabel name="alice" username="alice" isVerified={false} />)
        const label = screen.getByText('alice')
        expect(label).not.toHaveClass('ph-mask')
        expect(maskText('alice', label)).toBe('alice')
    })

    it('a page URL and a request path', () => {
        const origin = window.location.origin
        const name = (url: string) =>
            maskReplayNetworkRequest({ duration: 1, entryType: 'resource', startTime: 0, name: url }).name
        expect(name(`${origin}/request/alice`)).toBe(`${origin}/request/alice`)
        expect(name('https://api.peanut.me/users/username/alice')).toBe('https://api.peanut.me/users/username/alice')
        expect(name('https://api.peanut.me/users/accounts/42')).toBe('https://api.peanut.me/users/accounts/42')
        expect(maskAttribute('href', '/alice', document.createElement('a'))).toBe('/alice')
    })

    it('a button label and its accessible name', () => {
        const button = document.createElement('button')
        expect(maskText('Add money', button)).toBe('Add money')
        expect(maskAttribute('aria-label', 'Close', button)).toBe('Close')
        expect(maskAttribute('title', 'Copy profile link', button)).toBe('Copy profile link')
    })
})

describe('stays masked', () => {
    it("a legal name: an account holder's data-row value, and a full name on the user label", () => {
        render(<DataRow label="Account owner" value="Alice Example" />)
        expect(maskText('Alice Example', screen.getByText('Alice Example'))).toBe('***** *******')
        expect(maskText('Account owner', screen.getByText('Account owner'))).toBe('Account owner')

        render(<VerifiedUserLabel name="Maria Souza" username="maria" isVerified />)
        const fullName = screen.getByText('Maria Souza')
        expect(fullName).toHaveClass('ph-mask')
        expect(maskText('Maria Souza', fullName)).toBe('***** *****')
    })

    it("a saved bank account's alias, in its row and in its edit button's accessible name", () => {
        const alias = {
            id: 'acc-alias',
            type: AccountType.MANTECA,
            identifier: 'casa.perro.sol',
            details: { countryCode: 'ARG', countryName: 'Argentina' },
        } as unknown as Account
        render(<SavedAccountsMapping accounts={[alias]} onItemClick={() => {}} onItemEdit={() => {}} />, {
            wrapper: IntlWrapper,
        })
        // the title ("Argentina · casa.perro.sol") and the body (the alias itself)
        for (const element of screen.getAllByText((text) => text.includes('casa.perro.sol'))) {
            expect(maskText(element.textContent ?? '', element)).not.toContain('casa')
        }
        const edit = screen.getByTestId('destination-edit')
        const accessibleName = edit.getAttribute('aria-label') ?? ''
        expect(accessibleName).toContain('casa.perro.sol')
        expect(maskAttribute('aria-label', accessibleName, edit)).not.toContain('casa')
    })

    it('the size of an amount in a data row', () => {
        render(<DataRow label="Amount" value="$8,500,000.00" />)
        expect(maskText('$8,500,000.00', screen.getByText('$8,500,000.00'))).toBe('****')
    })

    it('an accessible name on a sensitive element', () => {
        render(<DataRow label="Account owner" value="Alice Example" />)
        const value = screen.getAllByText('Alice Example')[0]
        expect(maskAttribute('aria-label', 'Alice Example', value)).toBe('***** *******')
    })

    it.each([
        ['an IBAN', 'IBAN DE89370400440532013000', 'IBAN ' + '*'.repeat(22)],
        ['an email', 'Sent to alice@example.test', 'Sent to ' + '*'.repeat('alice@example.test'.length)],
        // a digit run becomes *** whatever its length, so the size of an amount does not show
        ['an amount', '$1,234,567.89', '$***'],
        ['a small amount', 'Send $8.50', 'Send $***'],
        ['a CPF', 'CPF 123.456.789-09', 'CPF ***-***'],
        ['a CUIT', 'CUIT 20-12345678-9', 'CUIT ***-***-***'],
        ['a card number', '•••• 4242', '•••• ***'],
        ['an EVM address', '0x7a3F9c21bE04d5', '*'.repeat(16)],
        ['a base58 address', '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV', '*'.repeat(43)],
    ])('%s', (_name, text, expected) => {
        expect(maskReplayText(text)).toBe(expected)
    })

    it('a token, query or fragment in a URL, and userinfo', () => {
        const name = (url: string) =>
            maskReplayNetworkRequest({ duration: 1, entryType: 'resource', startTime: 0, name: url }).name
        expect(
            name('https://api.peanut.me/charges/3c9d1f2e-8a7b-4c6d-9e0f-1a2b3c4d5e6f/payments?to=0xabc#p=secret')
        ).toBe('https://api.peanut.me/charges/*/payments')
        expect(name('https://secret@api.peanut.me/users/me')).toBe('https://api.peanut.me/users/me')
        expect(maskAttribute('href', '/claim?c=8453#p=SECRET', document.createElement('a'))).toBe('/claim')
        expect(name('/qr-pay?qrCode=secret')).toBe('[REDACTED QR DATA]')
    })

    it('network bodies and headers', () => {
        const timing = { duration: 2, entryType: 'resource', startTime: 1 }
        expect(
            maskReplayNetworkRequest({
                ...timing,
                name: '/users/me',
                method: 'GET',
                status: 200,
                requestBody: '{"amount":"50"}',
                responseBody: '{"balance":"1234"}',
                requestHeaders: { authorization: 'Bearer secret' },
                responseHeaders: { 'set-cookie': 'secret' },
            })
        ).toEqual({ ...timing, name: '/users/me', method: 'GET', status: 200 })
    })
})

describe('layout attributes', () => {
    it('keeps class, style and stylesheet hrefs, so the replay still renders', () => {
        expect(maskReplayAttribute('class', 'p-4 gap-2 text-body-m')).toBe('p-4 gap-2 text-body-m')
        expect(maskReplayAttribute('style', 'width: 160px')).toBe('width: 160px')
        expect(maskReplayAttribute('href', '/_next/static/app.css?v=1', document.createElement('link'))).toBe(
            '/_next/static/app.css?v=1'
        )
        expect(maskReplayAttribute('data-url', '/qr-pay?qrCode=secret')).toBe('[REDACTED QR DATA]')
    })

    it('masks a value attribute by the same text rules', () => {
        expect(maskReplayTextIn('1500', document.createElement('span'))).toBe('***')
        expect(maskReplayAttribute('value', '1500', document.createElement('input'))).toBe('***')
    })
})
