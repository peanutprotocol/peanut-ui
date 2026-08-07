'use client'

import { usePathname } from 'next/navigation'
import { isValidLocale } from './config'
import { DEFAULT_LOCALE, type Locale } from './types'

/**
 * Marketing locale for client components that get no props — route-level
 * error.tsx boundaries in particular, which Next.js renders without params.
 * The `/{locale}/` URL prefix is the only locale source on marketing pages.
 */
export function useUrlLocale(): Locale {
    const pathname = usePathname()
    const first = pathname?.split('/')[1] ?? ''
    return isValidLocale(first) ? first : DEFAULT_LOCALE
}
