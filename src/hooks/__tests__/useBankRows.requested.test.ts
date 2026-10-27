import { requestedChip } from '@/hooks/useBankRows'

// Slava, 2026-10-27: after verification a bank method the user asked for read
// "Unlock", and the tap only said it was being set up. It reads Pending.

const verified = (residenceIso2: string, requested = { bank: true, local: false }) => ({
    approved: true,
    requested,
    residenceIso2,
})

describe('a requested bank feature after verification', () => {
    it('reads Pending on the currencies the residence gets', () => {
        expect(requestedChip('unlock', 'sepa', verified('PT'))).toBe('processing')
        expect(requestedChip('unlock', 'usd', verified('PT'))).toBe('processing')
    })

    it('keeps the offer where the residence never gets that rail, so MXN never waits forever', () => {
        expect(requestedChip('unlock', 'mxn', verified('PT'))).toBe('unlock')
        expect(requestedChip('unlock', 'mxn', verified('MX'))).toBe('processing')
    })

    it('reads Pix and Argentine transfers from the local feature, not the bank one', () => {
        expect(requestedChip('unlock', 'brl', verified('BR'))).toBe('unlock')
        expect(requestedChip('unlock', 'brl', verified('BR', { bank: false, local: true }))).toBe('processing')
    })

    it('leaves every other case alone', () => {
        expect(requestedChip('unlock', 'sepa', { ...verified('PT'), approved: false })).toBe('unlock')
        expect(requestedChip('unlock', 'sepa', { ...verified('PT'), requested: null })).toBe('unlock')
        expect(requestedChip('unlock', 'sepa', verified('PT', { bank: false, local: false }))).toBe('unlock')
        expect(requestedChip('active', 'sepa', verified('PT'))).toBe('active')
        expect(requestedChip('attention', 'sepa', verified('PT'))).toBe('attention')
    })
})
