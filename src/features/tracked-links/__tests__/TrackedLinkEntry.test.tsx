/** @jest-environment jsdom */
import { act, render } from '@testing-library/react'
import { enterGoPage } from '../bootstrap'
import TrackedLinkEntry from '../TrackedLinkEntry'

jest.mock('../bootstrap', () => ({ enterGoPage: jest.fn(async () => {}) }))

const handoff = '/home?app_entry=1&tl=alice&acq_invite=alice&tl_s=ig&tl_v=a1&tl_e=n1'

afterEach(() => {
    jest.clearAllMocks()
    Reflect.deleteProperty(document, 'prerendering')
})

it('runs the entry for its handoff once and renders nothing', () => {
    const { container } = render(<TrackedLinkEntry handoff={handoff} />)
    expect(container).toBeEmptyDOMElement()
    expect(enterGoPage).toHaveBeenCalledTimes(1)
    expect(Object.fromEntries(jest.mocked(enterGoPage).mock.calls[0][0])).toEqual({
        app_entry: '1',
        tl: 'alice',
        acq_invite: 'alice',
        tl_s: 'ig',
        tl_v: 'a1',
        tl_e: 'n1',
    })
})

it('waits until a prerendered page is shown', () => {
    Object.defineProperty(document, 'prerendering', { configurable: true, value: true })
    render(<TrackedLinkEntry handoff={handoff} />)
    expect(enterGoPage).not.toHaveBeenCalled()
    act(() => {
        document.dispatchEvent(new Event('prerenderingchange'))
    })
    expect(enterGoPage).toHaveBeenCalledTimes(1)
})
