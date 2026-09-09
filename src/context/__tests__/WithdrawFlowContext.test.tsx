import { render, act } from '@testing-library/react'
import { WithdrawFlowContextProvider, useWithdrawFlow } from '../WithdrawFlowContext'

// probe that surfaces the real provider's state + actions to the test
let ctx: ReturnType<typeof useWithdrawFlow>
function Probe() {
    ctx = useWithdrawFlow()
    return null
}

describe('WithdrawFlowContext resetWithdrawFlow', () => {
    test('clears abandoned flow state, including the compatibility modal', () => {
        render(
            <WithdrawFlowContextProvider>
                <Probe />
            </WithdrawFlowContextProvider>
        )

        act(() => {
            ctx.setSelectedMethod({ type: 'crypto', title: 'Crypto' })
            ctx.setAmountToWithdraw('50')
            ctx.setUsdAmount('50')
            ctx.setShowCompatibilityModal(true)
            ctx.setShowAllWithdrawMethods(true)
        })
        expect(ctx.selectedMethod).toEqual({ type: 'crypto', title: 'Crypto' })
        expect(ctx.showCompatibilityModal).toBe(true)

        act(() => {
            ctx.resetWithdrawFlow()
        })

        expect(ctx.selectedMethod).toBeNull()
        expect(ctx.amountToWithdraw).toBe('')
        expect(ctx.usdAmount).toBe('')
        expect(ctx.selectedBankAccount).toBeNull()
        expect(ctx.showAllWithdrawMethods).toBe(false)
        // the reset used to leave a browser-back-abandoned modal armed for the
        // next /withdraw/crypto entry — pin that it closes with everything else
        expect(ctx.showCompatibilityModal).toBe(false)
    })
})
