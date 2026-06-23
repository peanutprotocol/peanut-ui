/** @jest-environment jsdom */
import { resolveClaimLink } from '@/services/sendLinks'
import { generateKeysFromString, getParamsFromLink } from '@/utils/peanut-link.utils'

// A v4.4 Arbitrum claim link: c/v/i live in the query (survive the redirect),
// the password lives in the `#p=` fragment (mangled by the redirect).
const BASE = 'https://peanut.me/claim?c=42161&v=v4.4&i=181'
const PRISTINE = `${BASE}#p=abcdef0123456789`
// What the claim page looks like after the auth/KYC redirect remounts it with a
// corrupted fragment — same deposit slot, different (wrong) password.
const CORRUPTED = `${BASE}&step=bank#p=WRONGwrongWRONG`

const pubKeyOf = (link: string) => generateKeysFromString(getParamsFromLink(link).password).address

beforeEach(() => localStorage.clear())

describe('resolveClaimLink (TASK-20193)', () => {
    it('restores the pristine password after a redirect mangles the fragment', () => {
        // 1) recipient first opens the link → pristine password is captured
        expect(resolveClaimLink(PRISTINE)).toBe(PRISTINE)

        // 2) the post-redirect remount arrives with a corrupted fragment, which
        // on its own derives the wrong pubKey (the prod 404 root cause)...
        expect(pubKeyOf(CORRUPTED)).not.toBe(pubKeyOf(PRISTINE))

        // 3) ...but resolveClaimLink serves the pristine link, so the fetch uses
        // the correct pubKey instead of 404ing.
        const resolved = resolveClaimLink(CORRUPTED)
        expect(resolved).toBe(PRISTINE)
        expect(pubKeyOf(resolved)).toBe(pubKeyOf(PRISTINE))
    })

    it('first write wins — a later mangled load cannot overwrite a good capture', () => {
        resolveClaimLink(PRISTINE)
        resolveClaimLink(CORRUPTED)
        expect(resolveClaimLink(`${BASE}#p=yetAnotherWrongOne`)).toBe(PRISTINE)
    })

    it('passes through links without a deposit slot untouched', () => {
        const noSlot = 'https://peanut.me/claim#p=orphan'
        expect(resolveClaimLink(noSlot)).toBe(noSlot)
    })

    it('passes through non-URL input without throwing', () => {
        expect(resolveClaimLink('not a url')).toBe('not a url')
    })
})
