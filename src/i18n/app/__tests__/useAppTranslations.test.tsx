/**
 * The iOS-only cashback copy layer.
 *
 * App Store Review Guideline 3.1.5 (v) forbids cryptocurrency apps from
 * offering currency for "encouraging other users to download". The native iOS
 * build presents the referral programme as cashback; web and Android keep the
 * rewards vocabulary. The whole contract is: overrides apply on iOS only, and
 * every other platform renders byte-for-byte what it rendered before.
 */
import React, { type ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { AppLocale } from '../config'
import { deepMerge, type DeepPartial, type AppMessages } from '../messages'
import en from '../messages/en.json'
import es419 from '../messages/es-419.json'
import esAR from '../messages/es-AR.json'
import ptBR from '../messages/pt-BR.json'
import { useAppTranslations } from '../useAppTranslations'

const mockIsIOSNative = jest.fn()
jest.mock('@/utils/capacitor', () => ({
    isIOSNative: () => mockIsIOSNative(),
}))

const CATALOGS: Record<AppLocale, AppMessages> = {
    en,
    'es-419': deepMerge(en, es419 as DeepPartial<AppMessages>),
    'es-AR': deepMerge(deepMerge(en, es419 as DeepPartial<AppMessages>), esAR as DeepPartial<AppMessages>),
    'pt-BR': deepMerge(en, ptBR as DeepPartial<AppMessages>),
}

const wrapperFor = (locale: AppLocale) =>
    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <NextIntlClientProvider locale={locale} messages={CATALOGS[locale]} timeZone="UTC">
                {children}
            </NextIntlClientProvider>
        )
    }

const t = <N extends Parameters<typeof useAppTranslations>[0]>(namespace: N, locale: AppLocale = 'en') =>
    renderHook(() => useAppTranslations(namespace), { wrapper: wrapperFor(locale) }).result.current

describe('useAppTranslations', () => {
    beforeEach(() => mockIsIOSNative.mockReset())

    describe('off iOS', () => {
        beforeEach(() => mockIsIOSNative.mockReturnValue(false))

        it('renders the rewards vocabulary untouched', () => {
            expect(t('rewards')('title')).toBe('Rewards')
            expect(t('rewards')('lifetimeRewards', { amount: '$10.00' })).toBe(
                'Lifetime rewards: $10.00. To earn more, invite friends.'
            )
            expect(t('home.perk').raw('usedPeanut' as never)).toContain('used Peanut')
        })

        it('never reaches for an ios override even where one exists', () => {
            expect(t('qrPay')('success.earnedRewardTitle')).toBe('You earned a reward!')
            expect(t('transaction')('type.reward')).toBe('Reward')
            expect(t('profile')('menu.points')).toBe('Points')
        })
    })

    describe('on iOS', () => {
        beforeEach(() => mockIsIOSNative.mockReturnValue(true))

        it('prefers the ios override when the namespace has one', () => {
            expect(t('rewards')('title')).toBe('Cashback')
            expect(t('rewards')('lifetimeRewards', { amount: '$10.00' })).toBe('Lifetime cashback: $10.00')
            expect(t('qrPay')('success.earnedRewardTitle')).toBe('You earned cashback!')
            expect(t('transaction')('type.reward')).toBe('Cashback')
            expect(t('profile')('menu.points')).toBe('Cashback')
        })

        it('attributes cashback to the payment, not the signup', () => {
            expect(t('home.perk').raw('usedPeanut' as never)).toContain('paid with Peanut')
        })

        it('falls through to the base string when there is no override', () => {
            // same namespace as an overridden key, deliberately not overridden
            expect(t('rewards')('inviteNow')).toBe('Invite Now')
            expect(t('rewards')('peopleYouInvited')).toBe('People you invited')
            expect(t('qrPay')('success.splitThisBill')).toBe('Split this bill')
        })

        it('leaves namespaces without an ios block alone', () => {
            expect(t('navigation')).toBeDefined()
            expect(t('common')('done')).toBe(t('common')('done'))
        })

        it('resolves overrides in every locale, es-AR through the es-419 layer', () => {
            expect(t('rewards', 'es-419')('title')).toBe('Cashback')
            expect(t('rewards', 'pt-BR')('title')).toBe('Cashback')
            // es-AR overrides only what voseo changes; `title` comes from es-419
            expect(t('rewards', 'es-AR')('title')).toBe('Cashback')
            expect(t('rewards', 'es-AR')('earnWhenFriendsUse')).toBe(
                '¡Ganás cashback cada vez que tus amigos pagan con Peanut!'
            )
        })

        it('reports has() against both layers', () => {
            expect(t('rewards').has('howItWorks.title' as never)).toBe(true)
            expect(t('rewards').has('inviteNow' as never)).toBe(true)
            expect(t('rewards').has('nopeNotAKey' as never)).toBe(false)
        })
    })
})

describe('iosCopy catalog invariants', () => {
    const OVERRIDDEN = ['rewards', 'home', 'home.perk', 'home.carousel', 'qrPay', 'transaction', 'profile', 'global']

    const at = (root: unknown, path: string): unknown =>
        path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], root)

    const leaves = (node: unknown, prefix = ''): string[] =>
        node && typeof node === 'object'
            ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
                  leaves(v, prefix ? `${prefix}.${k}` : k)
              )
            : [prefix]

    // A typo in an override is invisible at runtime — it just never resolves —
    // so every override must shadow a key that actually exists in the namespace.
    it.each(OVERRIDDEN)('every %s.iosCopy key shadows a real base key', (namespace) => {
        const ns = at(en, namespace) as Record<string, unknown>
        const overrides = ns.iosCopy
        expect(overrides).toBeDefined()
        const orphans = leaves(overrides).filter((key) => at(ns, key) === undefined)
        expect(orphans).toEqual([])
    })

    // `ios` is already a content key (profile.backup.steps.ios), which is why the
    // override block is called iosCopy — a namespace whose own content sits under
    // `ios` would otherwise have every key silently redirected on iOS.
    it('does not reuse the pre-existing ios content key', () => {
        expect(at(en, 'profile.backup.steps.ios')).toBeDefined()
        expect(at(en, 'profile.backup.steps.iosCopy')).toBeUndefined()
    })
})
