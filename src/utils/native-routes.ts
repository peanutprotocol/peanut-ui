// url helpers for native app dynamic routes.
// in capacitor (static export), dynamic routes don't work — use query params instead.
// on web, use the normal path-based urls.

import { isCapacitor } from './capacitor'

export function profileUrl(username: string): string {
    return isCapacitor() ? `/send?recipient=${username}` : `/${username}`
}

export function sendUrl(username: string): string {
    return isCapacitor() ? `/send?recipient=${username}` : `/send/${username}`
}

export function requestUrl(username: string): string {
    return isCapacitor() ? `/request?recipient=${username}` : `/request/${username}`
}

export function qrClaimUrl(code: string): string {
    return isCapacitor() ? `/qr?code=${code}` : `/qr/${code}`
}

export function qrSuccessUrl(code: string): string {
    return isCapacitor() ? `/qr?code=${code}&view=success` : `/qr/${code}/success`
}

// native-only: routes to /pay-request page (no web equivalent — callers build semantic URLs on web)
export function chargePayUrl(chargeId: string, context?: string): string {
    const qs = context ? `&context=${context}` : ''
    return `/pay-request?chargeId=${chargeId}${qs}`
}

export function requestPotUrl(id: string): string {
    return `/pay-request?id=${id}`
}

export function addMoneyCountryUrl(countryPath: string): string {
    return isCapacitor() ? `/add-money?country=${countryPath}` : `/add-money/${countryPath}`
}

export function withdrawCountryUrl(countryPath: string, queryParams?: string): string {
    if (isCapacitor()) {
        const qs = queryParams ? `&${queryParams.replace('?', '')}` : ''
        return `/withdraw?country=${countryPath}${qs}`
    }
    return `/withdraw/${countryPath}${queryParams || ''}`
}

export function withdrawBankUrl(countryPath: string, queryParams?: string): string {
    if (isCapacitor()) {
        const qs = queryParams ? `&${queryParams.replace('?', '')}` : ''
        return `/withdraw?country=${countryPath}&view=bank${qs}`
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
