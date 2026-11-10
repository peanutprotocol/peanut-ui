import { UTM_MEDIUMS, type UtmParams } from '@/utils/utm.utils'

export const TRACKED_LINK_EVENT = 'tracked_link_visit'
export const TRACKED_LINK_ORIGIN = 'https://peanut.me'
export const TRACKED_LINK_TIMEOUT_MS = 1800
export type AcquisitionCampaign = Omit<UtmParams, 'source'> & { source: string }

// Only shipped acquisition pages belong here. Payment, auth and arbitrary URLs do not.
export const ACQUISITION_PAGES = [
    '/',
    '/us-europe-accounts',
    '/qr-payments/argentina',
    '/qr-payments/brazil',
    '/peanut-card',
    '/request-links',
    '/self-custody',
] as const
export type AcquisitionDestination =
    | { key: 'app-entry'; continuation: '/home' }
    | { key: 'public-page'; continuation: (typeof ACQUISITION_PAGES)[number] }

type LinkBase = {
    schemaVersion: 1
    linkId: string
    slug: string
    revision: number
    status: 'active' | 'retired'
    destination: AcquisitionDestination
}
export type ResolvedAcquisitionLink = LinkBase &
    (
        | { kind: 'invite'; policy: 'journey'; invite: { code: string }; campaign?: never; qr?: never }
        | {
              kind: 'campaign'
              policy: 'journey' | 'none'
              campaign: AcquisitionCampaign
              invite?: { code: string }
              qr?: never
          }
        | {
              kind: 'marketing_qr'
              policy: 'personless'
              campaign: AcquisitionCampaign
              qr: { id: string }
              invite?: never
          }
    )
export type AcquisitionLinkResolution =
    | { status: 200; link: ResolvedAcquisitionLink }
    | { status: 400 | 404 | 410 | 503 }

export function isAcquisitionSlug(value: unknown): value is string {
    return typeof value === 'string' && value.length <= 96 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

// Existing short usernames predate the current signup length rule. Identity still needs a server lookup.
export function isInviteUsername(value: unknown): value is string {
    return typeof value === 'string' && /^[a-z0-9]{1,64}$/.test(value)
}

export function parseAcquisitionRevision(value: unknown): number | null {
    if (typeof value === 'string' && !/^[1-9][0-9]{0,8}$/.test(value)) return null
    const revision = typeof value === 'string' ? Number(value) : value
    return typeof revision === 'number' && Number.isSafeInteger(revision) && revision > 0 && revision <= 999999999
        ? revision
        : null
}

function object(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}
function onlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
    return Object.keys(value).every((key) => keys.includes(key))
}
function label(value: unknown, max: number): value is string {
    return typeof value === 'string' && value.length <= max && /^[a-z0-9][a-z0-9._~+ -]*$/.test(value)
}
export function parseAcquisitionCampaign(value: unknown): AcquisitionCampaign | null {
    if (
        !object(value) ||
        !onlyKeys(value, ['source', 'medium', 'campaign', 'content', 'term']) ||
        typeof value.source !== 'string' ||
        value.source.length > 64 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.source) ||
        !Object.values(UTM_MEDIUMS).includes(value.medium as AcquisitionCampaign['medium']) ||
        typeof value.campaign !== 'string' ||
        value.campaign.length > 64 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.campaign) ||
        (value.content !== undefined && !label(value.content, 64)) ||
        (value.term !== undefined && !label(value.term, 64))
    )
        return null
    return value as AcquisitionCampaign
}

/** Validate the wire descriptor before any inviter, journey or navigation side effect. */
export function parseResolvedAcquisitionLink(value: unknown): ResolvedAcquisitionLink | null {
    if (
        !object(value) ||
        !onlyKeys(value, [
            'schemaVersion',
            'linkId',
            'slug',
            'revision',
            'status',
            'destination',
            'kind',
            'policy',
            'invite',
            'campaign',
            'qr',
        ]) ||
        value.schemaVersion !== 1 ||
        !isAcquisitionSlug(value.slug) ||
        typeof value.linkId !== 'string' ||
        !/^[a-z][a-z0-9_-]{1,127}$/.test(value.linkId) ||
        parseAcquisitionRevision(value.revision) !== value.revision ||
        !['active', 'retired'].includes(String(value.status)) ||
        !object(value.destination) ||
        !onlyKeys(value.destination, ['key', 'continuation'])
    )
        return null
    const destination = value.destination
    if (
        !(destination.key === 'app-entry' && destination.continuation === '/home') &&
        !(
            destination.key === 'public-page' &&
            ACQUISITION_PAGES.includes(destination.continuation as (typeof ACQUISITION_PAGES)[number])
        )
    )
        return null
    if (value.kind === 'invite') {
        if (
            value.policy !== 'journey' ||
            !isInviteUsername(value.slug) ||
            value.revision !== 1 ||
            !/^invite_[a-f0-9]{64}$/.test(value.linkId) ||
            !object(value.invite) ||
            !onlyKeys(value.invite, ['code']) ||
            value.invite.code !== value.slug ||
            value.campaign !== undefined ||
            value.qr !== undefined ||
            destination.key !== 'app-entry'
        )
            return null
    } else if (value.kind === 'campaign') {
        if (
            !value.slug.includes('-') ||
            !['journey', 'none'].includes(String(value.policy)) ||
            !parseAcquisitionCampaign(value.campaign) ||
            (value.invite !== undefined &&
                (!object(value.invite) || !onlyKeys(value.invite, ['code']) || !isInviteUsername(value.invite.code))) ||
            value.qr !== undefined
        )
            return null
    } else if (value.kind === 'marketing_qr') {
        if (
            !value.slug.startsWith('qr-') ||
            value.policy !== 'personless' ||
            !parseAcquisitionCampaign(value.campaign) ||
            !object(value.qr) ||
            !onlyKeys(value.qr, ['id']) ||
            !isAcquisitionSlug(value.qr.id) ||
            value.slug !== `qr-${value.qr.id}` ||
            value.invite !== undefined ||
            destination.key !== 'app-entry'
        )
            return null
    } else return null
    return value as ResolvedAcquisitionLink
}

export function acquisitionCampaignParams(campaign: AcquisitionCampaign): URLSearchParams {
    const params = new URLSearchParams()
    for (const key of ['source', 'medium', 'campaign', 'content', 'term'] as const) {
        if (campaign[key]) params.set(`utm_${key}`, campaign[key])
    }
    return params
}

/** Query input never selects ownership, campaign or destination. */
export function acquisitionHandoffPath(link: ResolvedAcquisitionLink, seen = false): string {
    const params = link.campaign ? acquisitionCampaignParams(link.campaign) : new URLSearchParams()
    params.set('app_entry', '1')
    params.set('tl', link.slug)
    params.set('tr', String(link.revision))
    if (link.invite) params.set('acq_invite', link.invite.code)
    if (seen) params.set('tl_seen', '1')
    return `/home?${params}`
}
