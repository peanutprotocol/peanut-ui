import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { TooltipContent } from '@/components/Tooltip/TooltipContent'
import { renderWithIntl } from '@/test-utils/intl'
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))

import {
    SESSION_RECORDING_PRIVACY,
    maskReplayAttribute,
    maskReplayNetworkRequest,
    maskReplayText,
    maskReplayTextIn,
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
        expect(SESSION_RECORDING_PRIVACY.maskAttributeFn?.('aria-label', 'Send 50 USD')).toBe('**** ** ***')
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
        ['Sent to alice@example.test', 'Sent to ******************'],
        ['Request from @alice_b', 'Request from ********'],
        [
            'To 7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
            'To ' + '*'.repeat('7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV'.length),
        ],
        ['bc1qxyzabcdefghjklmnpqrstuvwx', '*'.repeat('bc1qxyzabcdefghjklmnpqrstuvwx'.length)],
        ['IBAN DE89370400440532013000', 'IBAN ' + '*'.repeat(22)],
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
        // a link names who it points at; a stylesheet must stay loadable
        expect(maskReplayAttribute('href', '/alice', document.createElement('a'))).toBe('******')
        expect(maskReplayAttribute('href', '/_next/static/app.css', document.createElement('link'))).toBe(
            '/_next/static/app.css'
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

    it('masks identifying path segments and keeps the route words', () => {
        const name = (url: string) => maskReplayNetworkRequest({ ...timing, name: url }).name
        expect(name('https://api.peanut.me/users/username/alice')).toBe('https://api.peanut.me/users/username/*')
        expect(name('https://api.peanut.me/charges/3c9d1f2e-8a7b-4c6d-9e0f-1a2b3c4d5e6f/payments')).toBe(
            'https://api.peanut.me/charges/*/payments'
        )
        expect(name('http://localhost:5050/users/accounts/42?x=1')).toBe('http://localhost:5050/users/accounts/*?x=')
        expect(name('/relay/flags/')).toBe('/relay/flags/')
    })

    it('keeps the QR redaction', () => {
        expect(maskReplayNetworkRequest({ ...timing, name: '/qr-pay?qrCode=secret' }).name).toBe('[REDACTED QR DATA]')
    })
})

describe('maskReplayTextIn', () => {
    it('hides a data-row value whole, words included, and keeps its label', () => {
        // The bank withdrawal review shows the account holder, who can be a third party.
        render(<DataRow label="Account owner" value="Alice Example" />)
        const value = screen.getByText('Alice Example')
        const label = screen.getByText('Account owner')
        expect(maskReplayTextIn('Alice Example', value)).toBe('***** *******')
        expect(maskReplayTextIn('Account owner', label)).toBe('Account owner')
    })

    it('hides ph-mask text whole, as the shared user label marks names and usernames', () => {
        const name = document.createElement('div')
        name.className = 'ph-mask line-clamp-1'
        document.body.appendChild(name)
        expect(maskReplayTextIn('alice', name)).toBe('*****')
        name.remove()
    })

    it('keeps the words of ordinary text', () => {
        const button = document.createElement('button')
        expect(maskReplayTextIn('Withdraw 50', button)).toBe('Withdraw **')
        expect(SESSION_RECORDING_PRIVACY.maskTextFn?.('Withdraw 50', button)).toBe('Withdraw **')
    })
})

describe('names outside the user label', () => {
    it("hides an avatar's accessible name, which repeats the username", () => {
        renderWithIntl(<UserAvatar name="satoshi" avatarKey={null} />)
        const avatar = screen.getByRole('img', { name: 'Avatar for satoshi' })
        expect(SESSION_RECORDING_PRIVACY.maskAttributeFn?.('aria-label', 'Avatar for satoshi', avatar)).toBe(
            '****** *** *******'
        )
    })

    it('hides the invited-user tooltip, which is portaled outside the label', () => {
        render(
            <TooltipContent
                content="You've invited alice"
                contentClassName="ph-mask"
                position="top"
                initialPosition="top"
                coords={{ top: 0, left: 0, width: 10, height: 10 }}
                updatePosition={() => {}}
            />
        )
        const text = screen.getByText("You've invited alice")
        expect(maskReplayTextIn("You've invited alice", text)).toBe('****** ******* *****')
    })

    it('masks every accessible name whole, as the receipt avatar labels the payer by full name', () => {
        const avatarButton = document.createElement('button')
        expect(SESSION_RECORDING_PRIVACY.maskAttributeFn?.('aria-label', 'Alice Example', avatarButton)).toBe(
            '***** *******'
        )
        expect(SESSION_RECORDING_PRIVACY.maskAttributeFn?.('title', 'alice', avatarButton)).toBe('*****')
    })

    it('masks a contact handle rendered in the send contacts list', () => {
        render(<span className="ph-mask">@alice</span>)
        expect(maskReplayTextIn('@alice', screen.getByText('@alice'))).toBe('******')
    })
})
