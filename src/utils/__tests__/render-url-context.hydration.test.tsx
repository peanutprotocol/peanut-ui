import React from 'react'
import { act } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import * as capacitor from '@/utils/capacitor'
import { BASE_URL } from '@/constants/general.consts'
import { STORE_URL } from '@/constants/migration.consts'
import { useAppOrigin } from '@/hooks/useAppOrigin'
import { useNativePlatform } from '@/utils/native-platform'
import { appBaseUrl, payLinkUrl, shareableUrl } from '@/utils/url.utils'
import {
    profileUrl,
    sendUrl,
    recipientPayUrl,
    addMoneyCountryUrl,
    withdrawCountryUrl,
    rewriteMethodPath,
} from '@/utils/native-routes'
import { sanitizeRedirectURL } from '@/utils/cookie-url.utils'
import { generateInviteCodeLink, getValidRedirectUrl } from '@/utils/general.utils'
import { getBadgeShareLink } from '@/components/Badges/badge.utils'
import { REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { storeAnchorHref } from '@/utils/migration.utils'
import AddressLink from '@/components/Global/AddressLink'
import { getReceiptUrl } from '@/utils/history.utils'
import { getExchangeRateWidgetRedirectRoute } from '@/utils/exchangeRateWidget.utils'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
jest.mock('@/hooks/usePrimaryNameServer', () => ({ usePrimaryNameServer: () => ({ primaryName: undefined }) }))
jest.mock('@/components/0_Bruddle/LinkButton', () => ({ LinkButton: () => null }))

const mockBuildDeferredPayload = jest.fn(() => 'deferred=context')
jest.mock('@/utils/deferred-link', () => ({
    buildDeferredPayload: () => mockBuildDeferredPayload(),
    playStoreUrlWithReferrer: (payload: string) => `play://listing?referrer=${payload}`,
}))

const originalLocation = window.location
const capacitorDescriptor = Object.getOwnPropertyDescriptor(window, 'Capacitor')
let root: Root | undefined
let container: HTMLDivElement | undefined

function setEnvironment(native: boolean, origin: string) {
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: new URL(origin) })
    Object.defineProperty(window, 'Capacitor', {
        configurable: true,
        writable: true,
        value: native ? { isNativePlatform: () => true, getPlatform: () => 'android' } : undefined,
    })
}

afterEach(() => {
    if (root) act(() => root!.unmount())
    root = undefined
    container?.remove()
    container = undefined
    jest.restoreAllMocks()
    mockBuildDeferredPayload.mockClear()
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: originalLocation })
    if (capacitorDescriptor) Object.defineProperty(window, 'Capacitor', capacitorDescriptor)
    else Reflect.deleteProperty(window, 'Capacitor')
})

describe('explicit render URL context', () => {
    it.each([false, true])(
        'builds all explicit native=%s route modes without reading the runtime detector',
        (native) => {
            const detector = jest.spyOn(capacitor, 'isCapacitor').mockImplementation(() => {
                throw new Error('ambient detector must not run')
            })
            expect(profileUrl('alice', native)).toBe(native ? '/profile/view?username=alice' : '/alice')
            expect(sendUrl('alice', native)).toBe(native ? '/send?recipient=alice' : '/send/alice')
            expect(recipientPayUrl('alice/10usdc', native)).toBe(
                native ? '/send?recipient=alice%2F10usdc' : '/alice/10usdc'
            )
            expect(addMoneyCountryUrl('germany', native)).toBe(
                native ? '/add-money?country=germany' : '/add-money/germany'
            )
            expect(withdrawCountryUrl('germany', '?method=bank', native)).toBe(
                native ? '/withdraw?country=germany&method=bank' : '/withdraw/germany?method=bank'
            )
            expect(rewriteMethodPath('/add-money/germany/bank', 'returnTo=%2Fhome', native)).toBe(
                native
                    ? '/add-money?country=germany&view=bank&returnTo=%2Fhome'
                    : '/add-money/germany/bank?returnTo=%2Fhome'
            )
            expect(detector).not.toHaveBeenCalled()
        }
    )

    it.each([false, true])('keeps legacy default route/origin behavior in native=%s mode', (native) => {
        setEnvironment(native, 'https://localhost')
        expect(profileUrl('alice')).toBe(native ? '/profile/view?username=alice' : '/alice')
        expect(shareableUrl('/invite')).toBe(`${native ? BASE_URL : 'https://localhost'}/invite`)
    })

    it('builds explicit origins without consulting bridge or window origin', () => {
        jest.spyOn(capacitor, 'isCapacitor').mockImplementation(() => {
            throw new Error('ambient detector must not run')
        })
        const origin = 'https://preview.peanut.me'
        expect(appBaseUrl(origin)).toBe(origin)
        expect(shareableUrl('/receipt/abc', origin)).toBe(`${origin}/receipt/abc`)
        expect(payLinkUrl('/alice?chargeId=abc', origin)).toBe(`${origin}/pay/alice?chargeId=abc`)
        expect(generateInviteCodeLink('alice', undefined, origin).inviteLink).toBe(`${origin}/invite?code=alice`)
        expect(getBadgeShareLink(undefined, REFERRAL_SOURCES.BADGE_DETAIL, origin)).toBe(origin)
    })

    it.each([false, true])(
        'propagates explicit native=%s through widget route branches without ambient detection',
        (native) => {
            jest.spyOn(capacitor, 'isCapacitor').mockImplementation(() => {
                throw new Error('ambient detector must not run')
            })
            expect(getExchangeRateWidgetRedirectRoute('USD', 'MXN', 100, undefined, native)).toBe(
                native ? '/withdraw?country=mexico' : '/withdraw/mexico'
            )
            expect(getExchangeRateWidgetRedirectRoute('MXN', 'USD', 100, undefined, native)).toBe(
                native ? '/add-money?country=mexico' : '/add-money/mexico'
            )
            expect(getExchangeRateWidgetRedirectRoute('EUR', 'USD', 0, ['europe'], native)).toBe(
                native ? '/add-money?country=germany' : '/add-money/germany'
            )
        }
    )

    it('uses explicit receipt origins and null redirect context without reading window location', () => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            get: () => {
                throw new Error('ambient location must not run')
            },
        })
        const transaction = {
            id: 'entry-1',
            extraDataForDrawer: { kind: 'QR_PAY', publicReceipt: true },
        } as Parameters<typeof getReceiptUrl>[0]
        expect(getReceiptUrl(transaction, 'https://preview.peanut.me')).toBe(
            'https://preview.peanut.me/receipt/entry-1?kind=QR_PAY'
        )
        expect(shareableUrl('/invite', 'https://preview.peanut.me')).toBe('https://preview.peanut.me/invite')
        expect(sanitizeRedirectURL('/home', null)).toBeNull()
        expect(getValidRedirectUrl('/home', '/fallback', null)).toBe('/fallback')
        expect(sanitizeRedirectURL('/home', 'https://preview.peanut.me')).toBe('/home')
    })

    it('keeps the initial Android store href free of deferred browser storage context', () => {
        expect(storeAnchorHref('android', false, false)).toBe(STORE_URL.android)
        expect(mockBuildDeferredPayload).not.toHaveBeenCalled()
        expect(storeAnchorHref('android', false, true)).toContain('deferred=context')
        expect(mockBuildDeferredPayload).toHaveBeenCalledTimes(1)
    })

    it('keeps redirect validation unresolved before browser origin exists', () => {
        expect(sanitizeRedirectURL('/home?x=1', null)).toBeNull()
        expect(getValidRedirectUrl('/home?x=1', '/fallback', null)).toBe('/fallback')
        expect(sanitizeRedirectURL('/home?x=1', 'https://preview.peanut.me')).toBe('/home?x=1')
    })

    it.each([
        'https://evil.example/home',
        '//evil.example/home',
        '/.//evil.example/home',
        'https://user:secret@preview.peanut.me/home',
    ])('preserves same-origin redirect rejection for %s', (redirect) => {
        expect(sanitizeRedirectURL(redirect, 'https://preview.peanut.me')).toBeNull()
    })
})

describe('render URL hydration', () => {
    it.each([false, true])(
        'matches SSR and first client render then resolves native=%s URLs without replacing links',
        async (native) => {
            const renderValues: string[] = []
            function Tree() {
                const origin = useAppOrigin()
                const mode = useNativePlatform()
                const href = shareableUrl('/invite', origin)
                renderValues.push(`${mode.isCapacitor}:${href}`)
                return (
                    <section>
                        <a data-testid="origin-link" href={href}>
                            Invite
                        </a>
                        <AddressLink address="alice" inline />
                    </section>
                )
            }
            setEnvironment(false, 'https://server.example')
            const serverHtml = renderToString(<Tree />)
            expect(renderValues).toEqual([`false:${BASE_URL}/invite`])
            container = document.createElement('div')
            container.innerHTML = serverHtml
            document.body.appendChild(container)
            const originLink = container.querySelector('[data-testid="origin-link"]')
            const addressLink = container.querySelector('a[href="/alice"]')
            renderValues.length = 0
            setEnvironment(native, 'https://localhost')
            const onRecoverableError = jest.fn()
            await act(async () => {
                root = hydrateRoot(container!, <Tree />, { onRecoverableError })
            })
            expect(renderValues[0]).toBe(`false:${BASE_URL}/invite`)
            expect(onRecoverableError).not.toHaveBeenCalled()
            expect(container.querySelector('[data-testid="origin-link"]')).toBe(originLink)
            expect(originLink).toHaveAttribute('href', `${native ? BASE_URL : 'https://localhost'}/invite`)
            expect(addressLink).toHaveAttribute('href', native ? '/send?recipient=alice' : '/alice')
            if (native) expect(addressLink).not.toHaveAttribute('target')
            else expect(addressLink).toHaveAttribute('target', '_blank')
            expect(container.querySelector(`a[href="${native ? '/send?recipient=alice' : '/alice'}"]`)).toBe(
                addressLink
            )
        }
    )
})
