// Local copy of the /go engine's contract types, v1. The engine owns them: delete this file and
// import from '@/features/tracked-links/contract' when this branch stacks on the go-links PRs.

export type GoPlacement = 'ig' | 'x' | 'tt' | 'yt' | 'fb' | 'th' | 'wa' | 'tg' | 'li' | 'dc' | 'em' | 'qr'

export type GoVisit = {
    /** Lowercase, resolved by the backend lookup. */
    username: string
    /** From /go/<username>/<placement>. */
    placement: GoPlacement | null
    /** From /go/<username>/<code>, 1–9999. */
    code: number | null
    /** Allowlisted query values only. */
    utm: { source: string | null; medium: string | null; campaign: string | null; content: string | null }
    referrerHost: string | null
}

/** Plain data. The values are labels for events; a page shows none of them. */
export type CreatorPageProps = {
    creator: {
        username: string
        /** `invite_<64 hex>`, a public pseudonym; the same value as tracked_link_visit.link_id. */
        linkId: string
    }
    /** The variant the registry selected, passed back by the engine. */
    variant: string
    /** Same-tab link owned by the engine. A page never builds or edits it. */
    ctaHref: string
    visit: GoVisit
}
