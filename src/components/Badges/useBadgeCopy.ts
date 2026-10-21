'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { getBadgeDescription } from './badge.utils'

/**
 * Badge name + reason, keyed by badge code.
 *
 * The API localizes badge copy from the request's Accept-Language, so its
 * fields win. The app's `badges.catalog` only fills a field the API left
 * empty (an older API during a deploy); the code is the last resort.
 */
export function useBadgeCopy() {
    const t = useTranslations('badges.catalog')

    return useCallback(
        (code?: string, name?: string | null, description?: string | null) => {
            const nameKey = `${code}.name` as Parameters<typeof t>[0]
            const descriptionKey = `${code}.description` as Parameters<typeof t>[0]
            return {
                name: name?.trim() || (code && t.has(nameKey) ? t(nameKey) : code || 'Badge'),
                description:
                    getBadgeDescription(description) ?? (code && t.has(descriptionKey) ? t(descriptionKey) : null),
            }
        },
        [t]
    )
}
