/** @jest-environment jsdom */
import {
    EMPTY_PIX_WITHDRAW_DRAFT,
    forgetPixWithdrawDraft,
    keepPixWithdrawDraft,
    parsePixWithdrawDraft,
    readPixWithdrawDraft,
} from '../pixWithdrawDraft'

const FORM = { ...EMPTY_PIX_WITHDRAW_DRAFT, destination: '09579927189', amountBrl: '503' }

describe('the Pix withdraw draft', () => {
    afterEach(() => {
        jest.restoreAllMocks()
        forgetPixWithdrawDraft('u1')
        window.sessionStorage.clear()
        window.localStorage.clear()
    })

    it("keeps the form in this tab's session, under the account's own key", () => {
        keepPixWithdrawDraft('u1', FORM)
        expect(JSON.parse(window.sessionStorage.getItem('pix-withdraw-draft:u1')!)).toEqual(FORM)
        expect(window.localStorage.length).toBe(0)
        expect(readPixWithdrawDraft('u1')).toEqual(FORM)
    })

    it('never hands one account the draft of another', () => {
        keepPixWithdrawDraft('u1', FORM)
        expect(readPixWithdrawDraft('u2')).toEqual(EMPTY_PIX_WITHDRAW_DRAFT)
        forgetPixWithdrawDraft('u2')
        expect(readPixWithdrawDraft('u1')).toEqual(FORM)
        expect(readPixWithdrawDraft(undefined)).toEqual(EMPTY_PIX_WITHDRAW_DRAFT)
    })

    it('removes an empty form instead of storing it, and forgets one on request', () => {
        keepPixWithdrawDraft('u1', FORM)
        keepPixWithdrawDraft('u1', EMPTY_PIX_WITHDRAW_DRAFT)
        expect(window.sessionStorage.getItem('pix-withdraw-draft:u1')).toBeNull()
        keepPixWithdrawDraft('u1', FORM)
        forgetPixWithdrawDraft('u1')
        expect(readPixWithdrawDraft('u1')).toEqual(EMPTY_PIX_WITHDRAW_DRAFT)
    })

    it('reads a broken value as none, and a field that is not text as empty', () => {
        expect(parsePixWithdrawDraft(null)).toBeNull()
        expect(parsePixWithdrawDraft('{not json')).toBeNull()
        expect(parsePixWithdrawDraft('null')).toBeNull()
        expect(parsePixWithdrawDraft(JSON.stringify({ destination: 'k', amountUsd: 5 }))).toEqual({
            ...EMPTY_PIX_WITHDRAW_DRAFT,
            destination: 'k',
        })
    })

    // private mode, blocked or full storage: this page load holds the form, a new one starts again
    it('holds the form in memory where session storage throws, and a new page load has none', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('quota', 'QuotaExceededError')
        })
        keepPixWithdrawDraft('u1', FORM)
        expect(window.sessionStorage.length).toBe(0)
        expect(readPixWithdrawDraft('u1')).toEqual(FORM)

        jest.isolateModules(() => {
            const reloaded = jest.requireActual<typeof import('../pixWithdrawDraft')>('../pixWithdrawDraft')
            expect(reloaded.readPixWithdrawDraft('u1')).toEqual(EMPTY_PIX_WITHDRAW_DRAFT)
        })
    })
})
