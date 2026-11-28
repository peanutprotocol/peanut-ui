import { act, renderHook, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { DirectSendFlowProvider, useDirectSendFlowContext } from '../DirectSendFlowContext'

// TASK-25467: a bank page or /verify opened to add money comes back to Send with the amount
function renderContext(searchParams: string) {
    const updates: UrlUpdateEvent[] = []
    const Nuqs = withNuqsTestingAdapter({ searchParams, hasMemory: true, onUrlUpdate: (e) => updates.push(e) })
    const { result } = renderHook(() => useDirectSendFlowContext(), {
        wrapper: ({ children }) => (
            <Nuqs>
                <DirectSendFlowProvider>{children}</DirectSendFlowProvider>
            </Nuqs>
        ),
    })
    return { result, updates }
}

it('reads the amount back from the URL, the usd amount with it', () => {
    const { result } = renderContext('?amount=12.5')
    expect(result.current.amount).toBe('12.5')
    expect(result.current.usdAmount).toBe('12.5')
})

// review on ui#4316: parseFloat reads `5e3` as 5000 while the field shows nothing
it.each(['5e3', 'abc'])('ignores a URL amount the amount field would not hold: %s', (bad) => {
    const { result } = renderContext(`?amount=${bad}`)
    expect(result.current.amount).toBe('')
})

it('writes the amount to the URL and drops the param when it is cleared', async () => {
    const { result, updates } = renderContext('?amount=12.5')
    act(() => result.current.setAmount('20'))
    await waitFor(() => expect(updates.at(-1)?.queryString).toBe('?amount=20'))
    act(() => result.current.resetSendFlow())
    await waitFor(() => expect(updates.at(-1)?.searchParams.has('amount')).toBe(false))
})
