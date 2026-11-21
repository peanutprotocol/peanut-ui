/**
 * Characterization of dev (before ui#4201): a send link's password stays on
 * the device under `sendLink::password::<pubKey>`, so the sender's Activity
 * row shows the share link again, also after a sign-out (the sign-out half is
 * pinned in context/__tests__/authContext-logout.test.tsx).
 */
import { saveToLocalStorage } from '@/utils/general.utils'
import { completeHistoryEntry, type HistoryEntry } from '../history.utils'
import { keepSendLinkPassword, readSendLinkPassword } from '../send-link-password'

jest.mock('@/app/actions/currency', () => ({ getCachedCurrencyPrice: jest.fn() }))
jest.mock('@/utils/token.utils', () => ({
    ...jest.requireActual('@/utils/token.utils'),
    getTokenDetails: jest.fn(() => ({ symbol: 'USDC', decimals: 6 })),
}))

beforeEach(() => window.localStorage.clear())

it("keeps the password under dev's key, so a bundle from before this change reads it", () => {
    keepSendLinkPassword('0xAbC', 'secret')
    expect(JSON.parse(window.localStorage.getItem('sendLink::password::0xAbC') as string)).toBe('secret')
})

it('reads a password the dev app stored', () => {
    saveToLocalStorage('sendLink::password::0xAbC', 'from-dev')
    expect(readSendLinkPassword('0xAbC')).toBe('from-dev')
})

it("shows the share link on the sender's own row, which the API sends without senderAccount.userId", async () => {
    saveToLocalStorage('sendLink::password::0xlinkkey', 'secret')
    // The API's own-side account for the viewer (transaction-intent/history.ts `ownSideAccount`).
    const entry = {
        uuid: 'intent-1',
        type: 'TRANSACTION_INTENT',
        timestamp: new Date('2026-11-20T10:00:00Z'),
        amount: '2.00',
        chainId: '42161',
        tokenSymbol: 'USDC',
        tokenAddress: '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d',
        status: 'PENDING',
        userRole: 'SENDER',
        senderAccount: { identifier: 'u1', type: 'peanut-wallet', isUser: true },
        recipientAccount: { identifier: '', type: 'address', isUser: false },
        extraData: { kind: 'SEND_LINK', parentSendLinkPubKey: '0xlinkkey', contractVersion: 'v4.3', depositIdx: 7 },
    } as unknown as HistoryEntry

    const completed = await completeHistoryEntry(entry)

    expect(completed.extraData?.link).toContain('i=7#p=secret')
})
