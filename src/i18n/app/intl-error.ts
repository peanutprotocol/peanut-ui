import { IntlErrorCode, type IntlError } from 'next-intl'

/** Shared by every intl provider (IntlCore and the route-locale one). */
export function onIntlError(error: IntlError): void {
    if (error.code === IntlErrorCode.MISSING_MESSAGE) {
        // unreachable for valid keys (catalogs are deep-merged over English);
        // never crash on copy in production
        if (process.env.NODE_ENV !== 'production') console.warn(error.message)
        return
    }
    console.error(error)
}
