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

jest.mock('@/hooks/useSplashGate', () => ({ useSplashGate: jest.fn() }))
jest.mock('@/hooks/useNativeAppLinks', () => ({ useNativeAppLinks: jest.fn() }))
jest.mock('@/hooks/useZeroLegacyAndroidSafeAreaInsets', () => ({ useZeroLegacyAndroidSafeAreaInsets: jest.fn() }))
// Both sit ABOVE the two providers under test, so stubbing them can't mask the
// contract. PeanutProvider pulls the wagmi config (http() at module scope) and
// nuqs ships ESM jest won't transform — neither survives jsdom import.
jest.mock('@/config/peanut.config', () => ({
    PeanutProvider: function PeanutProvider({ children }: { children: React.ReactNode }) {
        return children
    },
}))
// The component is invoked as a plain function rather than rendered, so the
// router hook it now calls has no context. An app route is what keeps the full
// provider tree in the chain being asserted.
let pathname = '/home'
jest.mock('next/navigation', () => ({ usePathname: () => pathname }))
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
        // next/dynamic components are anonymous; record them so the chain still
        // shows a lazily-loaded provider occupying a slot.
        acc.push(type.displayName ?? type.name ?? '(dynamic)')
    }
    const children = (node.props as { children?: React.ReactNode }).children
    // only follow the single-child spine; sibling leaves aren't providers
    if (React.Children.count(children) >= 1) {
        for (const child of React.Children.toArray(children)) providerChain(child, acc)
    }
    return acc
}

describe('ClientProviders provider order', () => {
    const chainFor = (path: string) => {
        pathname = path
        return providerChain(ClientProviders({ children: <div data-testid="app" /> }))
    }

    it('mounts the intl provider outside ContextProvider on app routes', () => {
        const chain = chainFor('/home')
        const context = chain.indexOf('ContextProvider')
        expect(context).toBeGreaterThan(0)
        // The app catalog is loaded via next/dynamic, so the provider is
        // anonymous here — what matters is that a layer sits between
        // PeanutProvider and ContextProvider, whose subtree calls
        // useTranslations (TokenContextProvider → useWallet → useSendMoney).
        expect(chain[context - 1]).toBe('(dynamic)')
    })

    // notifyAppReady has 15 s from launch before Capgo rolls the running bundle
    // back. A provider that only mounts once a lazily-loaded chunk resolves can
    // miss that window, or never mount at all if the chunk fails.
    it.each(['/home', '/setup', '/'])('mounts the OTA provider outermost on %s', (path) => {
        const chain = chainFor(path)
        expect(chain[0]).toBe('OtaUpdateProvider')
        expect(chain.lastIndexOf('OtaUpdateProvider')).toBe(0)
        expect(chain.indexOf('PeanutProvider')).toBeGreaterThan(0)
    })

    it('mounts the OTA provider above the lazily-loaded app providers', () => {
        const chain = chainFor('/home')
        expect(chain.indexOf('(dynamic)')).toBeGreaterThan(chain.indexOf('OtaUpdateProvider'))
    })

    it('mounts the marketing intl provider outside ContextProvider on the landing page', () => {
        const chain = chainFor('/')
        const intl = chain.indexOf('MarketingIntlProvider')
        const context = chain.indexOf('ContextProvider')
        expect(intl).toBeGreaterThanOrEqual(0)
        expect(context).toBeGreaterThanOrEqual(0)
        expect(intl).toBeLessThan(context)
    })
})
