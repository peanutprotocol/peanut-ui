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
            switch (result.kind) {
                case 'text':
                    return result.text
                case 'code':
                    return t(result.code)
                case 'params':
                    // `result.code` narrows to a single literal here, so next-intl
                    // resolves exactly this message's ICU args. If a SECOND
                    // parameterized code is ever added, switch on `result.code`
                    // inside this branch — otherwise next-intl collapses `values`
                    // to the intersection of both messages' args and neither one
                    // typechecks.
                    return t(result.code, result.values)
            }
        },
        [t]
    )
}
