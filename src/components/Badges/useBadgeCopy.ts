'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { getBadgeDescription, getBadgeDisplayName } from './badge.utils'

/**
 * Localized badge name, reason and public reason, keyed by badge code.
 *
 * The backend catalog owns badge identity and ships display-ready English, so it
 * stays the fallback: a code with no `badges.catalog` entry — a badge added
 * after this build — renders the backend prose rather than a raw key path.
 */
export function useBadgeCopy() {
    const t = useTranslations('badges.catalog')

    return useCallback(
        (code?: string, name?: string | null, description?: string | null, publicDescription?: string | null) => {
            const nameKey = `${code}.name` as Parameters<typeof t>[0]
            const descriptionKey = `${code}.description` as Parameters<typeof t>[0]
            const publicDescriptionKey = `${code}.publicDescription` as Parameters<typeof t>[0]
            return {
                name: code && t.has(nameKey) ? t(nameKey) : getBadgeDisplayName(code, name),
                description: code && t.has(descriptionKey) ? t(descriptionKey) : getBadgeDescription(description),
                // What a visitor to the profile reads: third person or person-neutral.
                publicDescription:
                    code && t.has(publicDescriptionKey)
                        ? t(publicDescriptionKey)
                        : getBadgeDescription(publicDescription ?? description),
            }
        },
        [t]
    )
}
