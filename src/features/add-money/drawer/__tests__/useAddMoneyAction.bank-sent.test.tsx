import { act, render } from '@testing-library/react'
import { useAddMoneyAction } from '../useAddMoneyAction'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
jest.mock('@/features/add-money/useAddMoneyReadiness', () => ({
    useAddMoneyReadiness: () => ({ isLoading: true, residenceIso2s: [], ready: {}, topUpGates: {} }),
}))
let onBankSent: ((inDollars: boolean) => void) | undefined
let returnTo: (() => string) | undefined
jest.mock('../AddMoneyDrawer', () => ({
    AddMoneyDrawer: (props: { onBankSent: (inDollars: boolean) => void; returnTo: () => string }) => {
        onBankSent = props.onBankSent
        returnTo = props.returnTo
        return null
    },
}))

type Props = {
    targetUsd: number
    spendableUsd: number
    balanceSettled: boolean
    step: string
    urlState: Record<string, string | undefined>
}
let result: ReturnType<typeof useAddMoneyAction>
function Place(props: Props) {
    result = useAddMoneyAction({ place: 'send', ...props })
    return result.drawer
}
const short = { targetUsd: 50, spendableUsd: 10, balanceSettled: true, step: 'ana:50', urlState: { amount: '50' } }

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

// chip on ui#4316/#4320: mid-refetch the raw smart+rain sum can count a move twice; the gap follows
// it, as the place's gate does, but "funded" waits until both reads settle
it('a covering balance mid-refetch keeps the note and the drawer until both reads settle', () => {
    const view = sendTransfer()
    view.rerender(<Place {...short} spendableUsd={60} balanceSettled={false} />)
    expect(result.gapUsd).toBe(0)
    expect(result.bankSent).toEqual({ usd: 40 })
    view.rerender(<Place {...short} spendableUsd={60} />)
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

it('the way back is the URL when a route opens, with the form amount on top', () => {
    window.history.replaceState({}, '', '/send/ana?amount=50')
    render(<Place {...short} />)
    act(() => result.openAddMoney())
    window.history.replaceState({}, '', '/send/ana?amount=50&ref=x')
    expect(returnTo!()).toBe('/send/ana?amount=50&ref=x')
})

// chip on ui#4320: nuqs queues its URL write, so a route opened right after an edit still reads the old amount
it('the way back carries the form amount when the URL write is still queued', () => {
    window.history.replaceState({}, '', '/send/ana?amount=25')
    const view = render(<Place {...short} />)
    act(() => result.openAddMoney())
    view.rerender(<Place {...short} targetUsd={30} step="ana:30" urlState={{ amount: '30' }} />)
    expect(returnTo!()).toBe('/send/ana?amount=30')
})
