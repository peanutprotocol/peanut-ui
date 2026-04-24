// url helpers for native app dynamic routes.
// in capacitor (static export), dynamic routes don't work — use query params instead.
// on web, use the normal path-based urls.

import { isCapacitor } from './capacitor'

export function profileUrl(username: string): string {
    return isCapacitor() ? `/send?recipient=${encodeURIComponent(username)}` : `/${username}`
}

export function sendUrl(username: string): string {
    return isCapacitor() ? `/send?recipient=${encodeURIComponent(username)}` : `/send/${username}`
}

export function requestUrl(username: string): string {
    return isCapacitor() ? `/request?recipient=${encodeURIComponent(username)}` : `/request/${username}`
}

export function qrClaimUrl(code: string): string {
    return isCapacitor() ? `/qr?code=${encodeURIComponent(code)}` : `/qr/${code}`
}

export function qrSuccessUrl(code: string): string {
    return isCapacitor() ? `/qr?code=${encodeURIComponent(code)}&view=success` : `/qr/${code}/success`
}

// these always use query params — they route to /pay-request which is a static page
// on both web and native. no dynamic path equivalent exists.
export function chargePayUrl(chargeId: string, context?: string): string {
    const qs = context ? `&context=${encodeURIComponent(context)}` : ''
    return `/pay-request?chargeId=${encodeURIComponent(chargeId)}${qs}`
}

export function requestPotUrl(id: string): string {
    return `/pay-request?id=${encodeURIComponent(id)}`
}

export function addMoneyCountryUrl(countryPath: string): string {
    return isCapacitor() ? `/add-money?country=${encodeURIComponent(countryPath)}` : `/add-money/${countryPath}`
}

export function withdrawCountryUrl(countryPath: string, queryParams?: string): string {
    if (isCapacitor()) {
        const qs = queryParams ? `&${queryParams.replace('?', '')}` : ''
        return `/withdraw?country=${encodeURIComponent(countryPath)}${qs}`
    }
    return `/withdraw/${countryPath}${queryParams || ''}`
}

export function withdrawBankUrl(countryPath: string, queryParams?: string): string {
    if (isCapacitor()) {
        const qs = queryParams ? `&${queryParams.replace('?', '')}` : ''
        return `/withdraw?country=${encodeURIComponent(countryPath)}&view=bank${qs}`
    }
    return `/withdraw/${countryPath}/bank${queryParams || ''}`
}

/**
 * rewrites a dynamic method.path for capacitor mode.
 * converts paths like /add-money/belgium/bank → /add-money?country=belgium&view=bank
 * and /withdraw/be/bank → /withdraw?country=be&view=bank
 * on web, returns the path unchanged.
 */
export function rewriteMethodPath(path: string, extraParams?: string): string {
    if (!isCapacitor()) return extraParams ? `${path}${path.includes('?') ? '&' : '?'}${extraParams}` : path

    // parse paths like /add-money/{country}/bank or /withdraw/{country}/bank
    const addMoneyMatch = path.match(/^\/add-money\/([^/?]+)(?:\/([^/?]+))?/)
    if (addMoneyMatch) {
        const country = addMoneyMatch[1]
        const subView = addMoneyMatch[2] // bank, manteca, etc.
        let url = `/add-money?country=${country}`
        if (subView) url += `&view=${subView}`
        if (extraParams) url += `&${extraParams}`
        return url
    }

    const withdrawMatch = path.match(/^\/withdraw\/([^/?]+)(?:\/([^/?]+))?/)
    if (withdrawMatch) {
        const country = withdrawMatch[1]
        const subView = withdrawMatch[2]
        // skip manteca (it's a static route, not dynamic)
        if (country === 'manteca' || country === 'crypto') {
            return extraParams ? `${path}${path.includes('?') ? '&' : '?'}${extraParams}` : path
        }
        let url = `/withdraw?country=${country}`
        if (subView) url += `&view=${subView}`
        if (extraParams) url += `&${extraParams}`
        return url
    }

    // not a dynamic route — return as-is
    return extraParams ? `${path}${path.includes('?') ? '&' : '?'}${extraParams}` : path
}
