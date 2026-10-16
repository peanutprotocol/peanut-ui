import React from 'react'
import { act, waitFor } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { IntlWrapper } from '@/test-utils/intl'
import BalanceWarningDrawer from '@/components/Global/BalanceWarningDrawer'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
jest.mock('@/components/Global/Drawer', () => {
    const Content = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
    return {
        Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
            open ? <div>{children}</div> : null,
        DrawerContent: Content,
        DrawerDescription: Content,
        DrawerHeader: Content,
        DrawerTitle: Content,
    }
})
jest.mock('@/components/0_Bruddle/SlideToConfirm', () => ({ __esModule: true, default: () => null }))

function Tree() {
    return (
        <IntlWrapper>
            <BalanceWarningDrawer visible onCloseAction={jest.fn()} />
        </IntlWrapper>
    )
}

describe('balance warning OS hydration contract', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    let userAgent: PropertyDescriptor | undefined
    beforeEach(() => {
        userAgent = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
        container = document.createElement('div')
        document.body.appendChild(container)
    })
    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        if (userAgent) Object.defineProperty(navigator, 'userAgent', userAgent)
        else Reflect.deleteProperty(navigator, 'userAgent')
    })

    it.each([
        ['ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'https://support.apple.com/en-us/102195'],
        ['android', 'Mozilla/5.0 (Linux; Android 13)', 'https://support.google.com/accounts/answer/6197437'],
    ])(
        'hydrates the UNKNOWN help link, then adopts the %s help link without replacing it',
        async (_platform, ua, expectedHref) => {
            Object.defineProperty(navigator, 'userAgent', { configurable: true, value: ua })
            container.innerHTML = renderToString(<Tree />)
            const help = container.querySelector('a[href="https://www.passkeys.com/what-are-passkeys"]')
            expect(help).not.toBeNull()
            const onRecoverableError = jest.fn()
            await act(async () => {
                root = hydrateRoot(container, <Tree />, { onRecoverableError })
            })
            await waitFor(() => expect(help).toHaveAttribute('href', expectedHref))
            expect(container.contains(help)).toBe(true)
            expect(onRecoverableError).not.toHaveBeenCalled()
        }
    )
})
