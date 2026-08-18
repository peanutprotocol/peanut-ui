'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { Region } from '@/utils/regions.utils'

/**
 * Display copy for a `Region`. `Region.name` stays the internal English
 * identifier `deriveRegionAccess` branches on, so every render site resolves the
 * localized label from the region's stable `path` instead. Regions with no
 * catalog entry (none today) fall back to the English name.
 */
export function useRegionLabel() {
    const t = useTranslations('common.regions')

    return useCallback(
        (region: Region): { name: string; description?: string } => {
            const nameKey = region.path as Parameters<typeof t>[0]
            const descriptionKey = `descriptions.${region.path}` as Parameters<typeof t>[0]
            return {
                name: t.has(nameKey) ? t(nameKey) : region.name,
                description: t.has(descriptionKey) ? t(descriptionKey) : region.description,
            }
        },
        [t]
    )
}
