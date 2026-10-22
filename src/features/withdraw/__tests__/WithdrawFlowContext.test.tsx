import { render, act } from '@testing-library/react'
import { WithdrawFlowProvider, useWithdrawFlow } from '../WithdrawFlowContext'

// probe that surfaces the real provider's state + actions to the test
let ctx: ReturnType<typeof useWithdrawFlow>
function Probe() {
    ctx = useWithdrawFlow()
    return null
}

describe('WithdrawFlowContext resetWithdrawFlow', () => {
    test('clears abandoned flow state, including the compatibility modal', () => {
        render(
            <WithdrawFlowProvider>
                <Probe />
            </WithdrawFlowProvider>
        )

        act(() => {
            ctx.setSelectedMethod({ type: 'crypto', title: 'Crypto' })
            ctx.setShowCompatibilityModal(true)
            ctx.setNetworkUnconfirmed(true)
        })
        expect(ctx.selectedMethod).toEqual({ type: 'crypto', title: 'Crypto' })
        expect(ctx.showCompatibilityModal).toBe(true)
        expect(ctx.networkUnconfirmed).toBe(true)

        act(() => {
            ctx.resetWithdrawFlow()
        })

        expect(ctx.selectedMethod).toBeNull()
        expect(ctx.selectedBankAccount).toBeNull()
        // the reset used to leave a browser-back-abandoned modal armed for the
        // next /withdraw/crypto entry — pin that it closes with everything else
        expect(ctx.showCompatibilityModal).toBe(false)
        // a scanned address's pending network pick goes with its destination
        expect(ctx.networkUnconfirmed).toBe(false)
    })
})
