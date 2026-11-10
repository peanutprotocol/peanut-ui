import { PEANUT_API_URL } from '@/constants/general.consts'
import {
    TRACKED_LINK_TIMEOUT_MS,
    isAcquisitionSlug,
    isInviteUsername,
    parseAcquisitionRevision,
    parseResolvedAcquisitionLink,
    type AcquisitionLinkResolution,
} from './contract'
import { resolveRegisteredAcquisitionLink } from './registry'

export const TRACKED_LINK_HEADERS = {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
}

/** No cookies, profile joins or side effects. Historical revisions serve measurement, never navigation overrides. */
export async function resolveAcquisitionLink(slug: string, revision?: number): Promise<AcquisitionLinkResolution> {
    if (!isAcquisitionSlug(slug) || (revision !== undefined && parseAcquisitionRevision(revision) === null))
        return { status: 400 }
    const registered = resolveRegisteredAcquisitionLink(slug, revision)
    if (registered) {
        if (registered.status === 'retired') return { status: 410 }
        if (registered.invite) {
            const identity = await resolveAcquisitionLink(registered.invite.code)
            if (identity.status !== 200) return identity
        }
        return { status: 200, link: registered }
    }
    if (!isInviteUsername(slug) || (revision !== undefined && revision !== 1)) return { status: 404 }
    try {
        const response = await fetch(`${PEANUT_API_URL}/tracked-links/invites/${encodeURIComponent(slug)}`, {
            cache: 'no-store',
            credentials: 'omit',
            redirect: 'error',
            signal: AbortSignal.timeout(TRACKED_LINK_TIMEOUT_MS),
            headers: { Accept: 'application/json' },
        })
        if (response.status === 404) return { status: 404 }
        if (!response.ok) return { status: 503 }
        const identity: unknown = await response.json()
        if (!identity || typeof identity !== 'object') return { status: 503 }
        const body = identity as Record<string, unknown>
        if (body.schemaVersion !== 1 || body.username !== slug) return { status: 503 }
        const link = parseResolvedAcquisitionLink({
            schemaVersion: 1,
            linkId: body.linkId,
            slug: body.username,
            revision: 1,
            kind: 'invite',
            status: 'active',
            policy: 'journey',
            invite: { code: body.username },
            destination: { key: 'app-entry', continuation: '/home' },
        })
        return link ? { status: 200, link } : { status: 503 }
    } catch {
        return { status: 503 }
    }
}
