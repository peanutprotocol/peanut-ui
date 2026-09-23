import { render } from '@testing-library/react'
import { CrispLauncher } from '../CrispLauncher'
import { isCapacitor } from '@/utils/capacitor'
import { isNativeHelpContext } from '@/utils/native-help-context'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))
jest.mock('@/utils/native-help-context', () => ({ isNativeHelpContext: jest.fn(() => false) }))

const SCRIPT_SELECTOR = 'script[src="https://client.crisp.chat/l.js"]'

beforeEach(() => {
    jest.mocked(isCapacitor).mockReturnValue(false)
    jest.mocked(isNativeHelpContext).mockReturnValue(false)
    window.$crisp = undefined
    document.querySelectorAll(SCRIPT_SELECTOR).forEach((script) => script.remove())
})

it('loads the normal website launcher and hides it when leaving marketing', () => {
    const { unmount } = render(<CrispLauncher />)
    window.dispatchEvent(new Event('load'))
    expect(window.$crisp).toContainEqual(['do', 'chat:show'])
    expect(document.querySelector(SCRIPT_SELECTOR)).not.toBeNull()
    unmount()
    expect(window.$crisp?.slice(-2)).toEqual([
        ['do', 'chat:close'],
        ['do', 'chat:hide'],
    ])
})

it.each(['browser sheet', 'native webview'])('suppresses the duplicate launcher in the %s', (surface) => {
    jest.mocked(isNativeHelpContext).mockReturnValue(surface === 'browser sheet')
    jest.mocked(isCapacitor).mockReturnValue(surface === 'native webview')
    const { unmount } = render(<CrispLauncher />)
    window.dispatchEvent(new Event('load'))
    // Keep explicit support links functional, but never show the bubble by default.
    expect(document.querySelector(SCRIPT_SELECTOR)).not.toBeNull()
    expect(window.$crisp).not.toContainEqual(['do', 'chat:show'])
    expect(window.$crisp?.slice(0, 2)).toEqual([
        ['do', 'chat:close'],
        ['do', 'chat:hide'],
    ])
    const onClosed = window.$crisp?.find(
        (command: unknown[]) => command[0] === 'on' && command[1] === 'chat:closed'
    )?.[2]
    expect(onClosed).toEqual(expect.any(Function))
    ;(onClosed as () => void)()
    expect(window.$crisp?.slice(-1)).toEqual([['do', 'chat:hide']])
    unmount()
    expect(window.$crisp).toContainEqual(['off', 'chat:closed'])
})
