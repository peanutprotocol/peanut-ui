'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'

// Rain's titles are cut at 50 characters on Rain's side.
const RAIN_TITLE_LIMIT = 50

/** An option code's label: the catalog's copy when it has one, else the raw value (Rain's job titles). */
export function useOptionLabel() {
    const t = useTranslations('kyc.verifyOnce.options')
    return useCallback(
        (fieldKey: string, code: string) => {
            const key = `${fieldKey}.${code}`
            if (t.has(key as never)) return t(key as never)
            return code.length === RAIN_TITLE_LIMIT ? `${code.trimEnd()}…` : code
        },
        [t]
    )
}
