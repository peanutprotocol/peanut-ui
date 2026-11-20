import { UTM_MEDIUMS, type UtmMedium } from '@/utils/utm.utils'
import type { GoVisit } from './contract'

/** Credits a `/go/<alias>` to an inviter with fixed campaign tags. */
export type GoAlias = { inviter: string; medium: UtmMedium; campaign: string }

/** The API's system attribution account: the inviter of `?code=squirrel`, the link with no personal inviter. */
export const COMPANY_INVITER = 'squirrel'

/**
 * Campaign slugs that `/go/` accepts in place of a username, keyed by the path's first segment, so no
 * URL value chooses the inviter or the tags. An alias wins over a same-named username and never shows
 * a creator page or queues a creator badge. Adding one is a reviewed change; doc: mono
 * engineering/ui/tracked-links.md.
 */
export const GO_ALIASES: Readonly<Record<string, GoAlias>> = {
    // Palermo street posters, one code per poster: /go/palermo/1–3 (20 November 2026).
    palermo: { inviter: COMPANY_INVITER, medium: UTM_MEDIUMS.CPM, campaign: 'palermo' },
}

export function goAlias(slug: string): GoAlias | undefined {
    // Slugs such as `constructor` must not read the object prototype.
    return Object.prototype.hasOwnProperty.call(GO_ALIASES, slug) ? GO_ALIASES[slug] : undefined
}

/** The alias's tags win over the query, as the path wins for placement and code. */
export function withGoAlias(visit: GoVisit, alias: GoAlias): GoVisit {
    return { ...visit, utm: { ...visit.utm, medium: alias.medium, campaign: alias.campaign } }
}
