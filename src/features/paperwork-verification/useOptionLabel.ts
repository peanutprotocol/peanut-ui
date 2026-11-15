'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'

/** An option code's label: the catalog's copy when it has one, else the raw code. */
export function useOptionLabel() {
    const t = useTranslations('kyc.paperworkVerification.options')
    return useCallback(
        (fieldKey: string, code: string) => {
            const key = `${fieldKey}.${code}`
            return t.has(key as never) ? t(key as never) : code
        },
        [t]
    )
}
