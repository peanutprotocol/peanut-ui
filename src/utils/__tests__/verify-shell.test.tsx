import { render } from '@testing-library/react'
import { resetVerifyShellForTests, useVerifyShell, useVerifyShellHold } from '@/utils/verify-shell'

// Staging, 2026-11-03: a feature's activation screen on /add-money sat inset in the app
// shell, the bottom nav over its panel. A /verify layout holds the full-screen shell wherever it opens.
function Shell() {
    return <span data-testid="shell">{useVerifyShell() ? 'verify' : 'app'}</span>
}

function Screen() {
    useVerifyShellHold()
    return null
}

describe('verify shell', () => {
    beforeEach(() => resetVerifyShellForTests())

    it('is the app shell with no /verify screen open', () => {
        const { getByTestId } = render(<Shell />)
        expect(getByTestId('shell')).toHaveTextContent('app')
    })

    it('is the verify shell while a /verify screen is mounted, and the app shell after', () => {
        const { getByTestId, rerender } = render(
            <>
                <Shell />
                <Screen />
            </>
        )
        expect(getByTestId('shell')).toHaveTextContent('verify')
        rerender(<Shell />)
        expect(getByTestId('shell')).toHaveTextContent('app')
    })

    it('stays the verify shell while one screen hands over to the next', () => {
        const { getByTestId, rerender } = render(
            <>
                <Shell />
                <Screen key="consent" />
            </>
        )
        rerender(
            <>
                <Shell />
                <Screen key="ready" />
            </>
        )
        expect(getByTestId('shell')).toHaveTextContent('verify')
    })
})
