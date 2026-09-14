import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { friendlyError, type FriendlyErrorOptions } from '@/utils/friendly-error.utils'

/**
 * Maps a caught error to user-facing copy. `friendlyError` classifies the error
 * into a display code (localized here) or verbatim backend text (passed through
 * untranslated). Usable in any client component or hook.
 */
export function useFriendlyError() {
    const t = useTranslations('errors')
    return useCallback(
        (error: unknown, opts?: FriendlyErrorOptions): string => {
            const result = friendlyError(error, opts)
            switch (result.kind) {
                case 'text':
                    return result.text
                case 'code':
                    return t(result.code)
                case 'params':
                    // Switch on `result.code` so each branch narrows to one
                    // literal and next-intl resolves exactly that message's ICU
                    // args; otherwise `values` collapses to the intersection of
                    // both messages' args and neither one typechecks.
                    switch (result.code) {
                        case 'rainCooldownRetry':
                            return t(result.code, result.values)
                        case 'xchainWithdrawLimitRetry':
                            return t(result.code, result.values)
                        case 'xchainPaymentLimitRetry':
                            return t(result.code, result.values)
                    }
            }
        },
        [t]
    )
}
