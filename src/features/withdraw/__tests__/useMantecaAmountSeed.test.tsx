import { act, renderHook } from '@testing-library/react'
import { useMantecaAmountSeed } from '../useMantecaAmountSeed'

// TASK-21664 / Chip round 3: the ?amount= hand-off into the Manteca flow.
// The param is user-editable, so the seed must not outrun the amount screen's
// balance/limits gates — and the seeded flow's back/retry paths must behave.

const BASE = {
    urlAmount: '50',
    currencyPriceSell: 1500, // ARS per USD — the AmountInput primary-denomination direction
    step: 'amount',
    isAmountAllowed: (() => true) as (usd: string) => boolean,
    limitsLoading: false,
    limitsBlocking: false,
}

function harness(overrides: Partial<typeof BASE> = {}) {
    const setUsdAmount = jest.fn()
    const setCurrencyAmount = jest.fn()
    const goToBankDetails = jest.fn()
    const view = renderHook(
        (props: Partial<typeof BASE>) =>
            useMantecaAmountSeed({
                ...BASE,
                ...props,
                setUsdAmount,
                setCurrencyAmount,
                goToBankDetails,
            }),
        { initialProps: overrides }
    )
    return { ...view, setUsdAmount, setCurrencyAmount, goToBankDetails }
}

describe('useMantecaAmountSeed', () => {
    it('seeds BOTH denominations from ?amount= — USD verbatim, local = usd × sell — and advances to bank-details', () => {
        const { setUsdAmount, setCurrencyAmount, goToBankDetails } = harness()
        expect(setUsdAmount).toHaveBeenCalledWith('50.00')
        // the conversion direction must match AmountInput's primary price
        // (sell = local per 1 USD): 50 USD × 1500 = 75000 ARS
        expect(setCurrencyAmount).toHaveBeenCalledWith('75000.00')
        expect(goToBankDetails).toHaveBeenCalledTimes(1)
    })

    it('does NOT advance while the gates block — the amount screen shows the reason (Chip round 3)', () => {
        for (const blocked of [
            { limitsBlocking: true },
            { limitsLoading: true },
            // over-balance, below-minimum, and balance-still-loading all
            // arrive through the synchronous validator
            { isAmountAllowed: () => false },
        ]) {
            const { setUsdAmount, goToBankDetails } = harness(blocked)
            // the amounts still seed (the screen shows them + the blocking card)
            expect(setUsdAmount).toHaveBeenCalledWith('50.00')
            expect(goToBankDetails).not.toHaveBeenCalled()
        }
    })

    it('asks the validator about the normalized seeded amount, synchronously', () => {
        const isAmountAllowed = jest.fn(() => true)
        harness({ isAmountAllowed })
        expect(isAmountAllowed).toHaveBeenCalledWith('50.00')
    })

    it('advances once a blocking gate clears', async () => {
        const { rerender, goToBankDetails } = harness({ limitsLoading: true })
        expect(goToBankDetails).not.toHaveBeenCalled()
        await act(async () => rerender({ limitsLoading: false }))
        expect(goToBankDetails).toHaveBeenCalledTimes(1)
    })

    it('ignores malformed or missing amounts and never advances', () => {
        for (const urlAmount of ['', '0', '-5', 'abc']) {
            const { setUsdAmount, goToBankDetails } = harness({ urlAmount })
            expect(setUsdAmount).not.toHaveBeenCalled()
            expect(goToBankDetails).not.toHaveBeenCalled()
        }
    })

    it('waits for the FX rate before converting', async () => {
        const { rerender, setCurrencyAmount, goToBankDetails } = harness({ currencyPriceSell: undefined })
        expect(setCurrencyAmount).not.toHaveBeenCalled()
        await act(async () => rerender({ currencyPriceSell: 1500 }))
        expect(setCurrencyAmount).toHaveBeenCalledWith('75000.00')
        expect(goToBankDetails).toHaveBeenCalledTimes(1)
    })

    it('reports seededFromUrl so back from bank-details returns to the ROOT amount step', () => {
        const seeded = harness()
        expect(seeded.result.current.seededFromUrl).toBe(true)
        const notSeeded = harness({ urlAmount: '' })
        expect(notSeeded.result.current.seededFromUrl).toBe(false)
    })

    it('Try again re-arms: resetSeed + returning to the amount step re-seeds and re-advances', async () => {
        const { result, setUsdAmount, goToBankDetails } = harness()
        expect(goToBankDetails).toHaveBeenCalledTimes(1)

        // terminal failure → resetState clears the amounts and resets the seed;
        // the flow is back on the amount step, so the seed re-arms immediately
        setUsdAmount.mockClear()
        goToBankDetails.mockClear()
        await act(async () => result.current.resetSeed())

        expect(setUsdAmount).toHaveBeenCalledWith('50.00')
        expect(goToBankDetails).toHaveBeenCalledTimes(1)
    })

    it('seeds only once per arm — later renders do not clobber a user-corrected amount', async () => {
        const { rerender, setUsdAmount } = harness()
        expect(setUsdAmount).toHaveBeenCalledTimes(1)
        await act(async () => rerender({ isAmountAllowed: () => false }))
        await act(async () => rerender({ isAmountAllowed: () => true }))
        expect(setUsdAmount).toHaveBeenCalledTimes(1)
    })
})
