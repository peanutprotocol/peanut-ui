import {
    TRACKED_LINK_ORIGIN,
    TRACKED_LINK_TIMEOUT_MS,
    isAcquisitionSlug,
    parseAcquisitionRevision,
    parseResolvedAcquisitionLink,
    type AcquisitionLinkResolution,
} from './contract'
import { isNativeBridge } from '@/utils/capacitor'

export async function resolveAcquisitionLinkClient(
    slug: string,
    revision?: number
): Promise<AcquisitionLinkResolution> {
    if (!isAcquisitionSlug(slug) || (revision !== undefined && parseAcquisitionRevision(revision) === null))
        return { status: 400 }
    const suffix = revision === undefined ? '' : `?revision=${revision}`
    const path = `/api/tracked-links/resolve/${encodeURIComponent(slug)}${suffix}`
    try {
        const response = await fetch(isNativeBridge() ? `${TRACKED_LINK_ORIGIN}${path}` : path, {
            credentials: 'omit',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
            redirect: 'error',
            signal: AbortSignal.timeout(TRACKED_LINK_TIMEOUT_MS),
            headers: { Accept: 'application/json' },
        })
        if ([400, 404, 410].includes(response.status)) return { status: response.status as 400 | 404 | 410 }
        if (!response.ok) return { status: 503 }
        const link = parseResolvedAcquisitionLink(await response.json())
        return link && link.slug === slug && (revision === undefined || link.revision === revision)
            ? link.status === 'retired'
                ? { status: 410 }
                : { status: 200, link }
            : { status: 503 }
    } catch {
        return { status: 503 }
    }
}
