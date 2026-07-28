import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { friendlyError } from '@/utils/friendly-error.utils'

/**
 * Maps a caught error to user-facing copy. `friendlyError` classifies the error
 * into a display code (localized here) or verbatim backend text (passed through
 * untranslated). Usable in any client component or hook.
 */
export function useFriendlyError() {
    const t = useTranslations('errors')
    return useCallback(
        (error: unknown): string => {
            const result = friendlyError(error)
            return result.kind === 'text' ? result.text : t(result.code)
        },
        [t]
    )
}
