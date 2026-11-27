import { act, render } from '@testing-library/react'
import { useAddMoneyAction } from '../useAddMoneyAction'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
jest.mock('@/features/add-money/useAddMoneyReadiness', () => ({
    useAddMoneyReadiness: () => ({ isLoading: true, residenceIso2s: [], ready: {}, topUpGates: {} }),
}))
let onBankSent: ((inDollars: boolean) => void) | undefined
jest.mock('../AddMoneyDrawer', () => ({
    AddMoneyDrawer: (props: { onBankSent: (inDollars: boolean) => void }) => {
        onBankSent = props.onBankSent
        return null
    },
}))

type Props = { targetUsd: number; spendableUsd: number; step: string }
let result: ReturnType<typeof useAddMoneyAction>
function Place(props: Props) {
    result = useAddMoneyAction({ place: 'send', ...props })
    return result.drawer
}
const short = { targetUsd: 50, spendableUsd: 10, step: 'ana:50' }

beforeEach(() => {
    sessionStorage.clear()
    onBankSent = undefined
})

function sendTransfer() {
    const view = render(<Place {...short} />)
    act(() => result.openAddMoney())
    act(() => onBankSent!(true))
    return view
}

it('keeps "on its way" through a remount of the same step', () => {
    sendTransfer().unmount()
    render(<Place {...short} />)
    expect(result.bankSent).toEqual({ usd: 40 })
})

it('keeps a non-dollar transfer unnamed', () => {
    render(<Place {...short} />)
    act(() => result.openAddMoney())
    act(() => onBankSent!(false))
    expect(result.bankSent).toEqual({ usd: null })
})

it('drops it once the balance covers the step, also after a remount', () => {
    const view = sendTransfer()
    view.rerender(<Place {...short} spendableUsd={60} />)
    expect(result.bankSent).toBeUndefined()
    view.unmount()
    render(<Place {...short} />)
    expect(result.bankSent).toBeUndefined()
})

it('drops it when the step changes: another amount or recipient', () => {
    const view = sendTransfer()
    view.rerender(<Place {...short} targetUsd={80} step="ana:80" />)
    expect(result.bankSent).toBeUndefined()
    // and going back to the first amount does not bring it back
    view.rerender(<Place {...short} />)
    expect(result.bankSent).toBeUndefined()
})
