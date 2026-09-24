'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'

/**
 * Localized badge copy, keyed by badge code. `badges.catalog` is the only owner of
 * badge prose; API payloads carry identity, never copy. `publicDescription` is what
 * visitors see and falls back to `description` when a badge has no separate wording.
 */
export function useBadgeCopy() {
    const t = useTranslations('badges.catalog')

    return useCallback(
        (code?: string) => {
            const catalogCopy = (field: 'name' | 'description' | 'publicDescription') => {
                const key = `${code}.${field}` as Parameters<typeof t>[0]
                return code && t.has(key) ? t(key) : null
            }
            const description = catalogCopy('description')
            return {
                name: catalogCopy('name') ?? (code || 'Badge'),
                description,
                publicDescription: catalogCopy('publicDescription') ?? description,
            }
        },
        [t]
    )
}
