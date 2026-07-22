/**
 * Provider ORDER contract.
 *
 * ContextProvider's subtree calls useTranslations (TokenContextProvider →
 * useWallet → useSendMoney), so AppIntlProvider must wrap it. When it didn't,
 * every route 500'd with "context from NextIntlClientProvider was not found" —
 * and no unit test caught it, because each one wraps its own subject in a
 * provider. This walks the real element tree instead of rendering it, so the
 * contract is checked without mocking the wallet/kernel/Capacitor stack.
 */
import React from 'react'
import { ClientProviders } from '../ClientProviders'

jest.mock('@/hooks/useOtaUpdates', () => ({ useOtaUpdates: jest.fn() }))
// Both sit ABOVE the two providers under test, so stubbing them can't mask the
// contract. PeanutProvider pulls the wagmi config (http() at module scope) and
// nuqs ships ESM jest won't transform — neither survives jsdom import.
jest.mock('@/config/peanut.config', () => ({
    PeanutProvider: function PeanutProvider({ children }: { children: React.ReactNode }) {
        return children
    },
}))
jest.mock('nuqs/adapters/next/app', () => ({
    NuqsAdapter: function NuqsAdapter({ children }: { children: React.ReactNode }) {
        return children
    },
}))

/** Component display names, outermost first, down the children spine. */
function providerChain(node: React.ReactNode, acc: string[] = []): string[] {
    if (!React.isValidElement(node)) return acc
    const type = node.type as { displayName?: string; name?: string } | string
    if (typeof type !== 'string') {
        const name = type.displayName ?? type.name
        if (name) acc.push(name)
    }
    const children = (node.props as { children?: React.ReactNode }).children
    // only follow the single-child spine; sibling leaves aren't providers
    if (React.Children.count(children) >= 1) {
        for (const child of React.Children.toArray(children)) providerChain(child, acc)
    }
    return acc
}

describe('ClientProviders provider order', () => {
    const chain = providerChain(ClientProviders({ children: <div data-testid="app" /> }))

    it('mounts AppIntlProvider outside ContextProvider', () => {
        const intl = chain.indexOf('AppIntlProvider')
        const context = chain.indexOf('ContextProvider')
        expect(intl).toBeGreaterThanOrEqual(0)
        expect(context).toBeGreaterThanOrEqual(0)
        // ContextProvider's subtree calls useTranslations — it must be inside intl
        expect(intl).toBeLessThan(context)
    })
})
