'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { isIOSNative } from '@/utils/capacitor'

type Namespace = NonNullable<Parameters<typeof useTranslations>[0]>

/**
 * `useTranslations` with an iOS-only copy layer.
 *
 * App Store Review Guideline 3.1.5 (v) forbids cryptocurrency apps from
 * offering currency for "encouraging other users to download". The native iOS
 * build therefore presents the referral programme as cashback, attributed to
 * the invitee's payment rather than to their signup. Web and Android keep the
 * rewards vocabulary and render byte-for-byte what they rendered before.
 *
 * Overrides live in an `iosCopy` block inside the namespace they belong to, so
 * `t('title')` resolves `rewards.iosCopy.title` on iOS and `rewards.title`
 * everywhere else. Keys with no override fall through untouched, which is why
 * the blocks carry only the strings that actually differ.
 *
 * Platform is read at render time, never at module scope: the Capacitor bridge
 * only lands on `window` after module eval, and is absent during prerender.
 */
export function useAppTranslations<N extends Namespace>(namespace: N): ReturnType<typeof useTranslations<N>> {
    const t = useTranslations(namespace)
    const ios = isIOSNative()

    return useMemo(() => {
        if (!ios) return t

        type Loose = {
            (key: string, ...rest: unknown[]): string
            rich: (key: string, ...rest: unknown[]) => unknown
            markup: (key: string, ...rest: unknown[]) => string
            raw: (key: string) => unknown
            has: (key: string) => boolean
        }
        const base = t as unknown as Loose
        const resolve = (key: string): string => (base.has(`iosCopy.${key}`) ? `iosCopy.${key}` : key)

        const wrapped = ((key: string, ...rest: unknown[]) => base(resolve(key), ...rest)) as Loose
        wrapped.rich = (key, ...rest) => base.rich(resolve(key), ...rest)
        wrapped.markup = (key, ...rest) => base.markup(resolve(key), ...rest)
        wrapped.raw = (key) => base.raw(resolve(key))
        wrapped.has = (key) => base.has(key) || base.has(`iosCopy.${key}`)

        return wrapped as unknown as typeof t
    }, [t, ios])
}
