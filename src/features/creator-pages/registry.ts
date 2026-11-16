// Owned by the creator-pages work (TASK-24893). The /go engine created this file as a stub and imports
// `selectCreatorPage` and `CreatorPageSelection` from it; only the creator-pages work edits it.
// Seam: the props and the label rule are in src/features/tracked-links/contract.ts (go-links contract v1);
// how the two sides meet is in mono engineering/ui/creator-pages.md.
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { createElement, type ComponentType } from 'react'
import type { CreatorPageProps } from '@/features/tracked-links/contract'
import { coversPageBottom, deviceOs } from './environment'
import { creatorPageExperiment } from './experiments'
import { creatorPageComponent } from './page-components'
import { pickVariant } from './pick-variant'
import { variantCookieName } from './variant-cookie'

/** The seam with the /go engine (go-links contract v1). The engine imports nothing else from this folder. */
export type CreatorPageSelection = {
    /** Passes the engine's `isGoPageLabel`, e.g. `a1`. The engine records it as `page_variant` on tracked_link_visit. */
    variant: string
    /** Same rule. The engine records it as `page_experiment`. */
    experimentId: string
    /** `null` is the contract's control arm (today's redirect). No experiment here uses one. */
    Page: ComponentType<CreatorPageProps> | null
    /** The engine spreads it into the page metadata, under its own `robots`. */
    metadata?: Metadata
}

/**
 * Server only. Everything a page needs from the request is read here, so the page itself renders
 * without waiting (see CreatorPageShell). Reads the variant cookie and never sets it: Next forbids
 * cookies().set during a page render, so CreatorPageProvider writes it in the browser.
 */
export async function selectCreatorPage(creator: {
    username: string
    linkId: string
}): Promise<CreatorPageSelection | null> {
    // Keyed by username, not linkId as the contract first said (deviation announced in the go-links
    // coordination notes): a link id differs per environment, so a linkId key would show the page in one only.
    const experiment = creatorPageExperiment(creator.username)
    if (!experiment) return null
    const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
    // One draw per request. Drawing inside the lookup re-rolled for every variant and skewed the split.
    // A request that carries DNT or GPC gets a fresh pick even if an older visit left the cookie:
    // the same two headers the visit route refuses on. CreatorPageProvider then removes the cookie.
    const refusesTracking = requestHeaders.get('dnt') === '1' || requestHeaders.get('sec-gpc') === '1'
    const variant = pickVariant(
        experiment,
        refusesTracking ? null : cookieStore.get(variantCookieName(creator.username))?.value
    )
    const Variant = variant && creatorPageComponent(creator.username, variant)
    if (!Variant) return null

    // The visitors are on phones in in-app browsers, where hydration is slow. Deciding the OS here
    // puts the right label and store icon in the first HTML, so nothing changes under the thumb.
    // Presentation only: the event reads the user agent in the browser, at tap time.
    // The same goes for the lift of the bottom button where the in-app browser covers the page's bottom edge.
    const userAgent = requestHeaders.get('user-agent') ?? ''
    const os = deviceOs(userAgent)
    const liftCta = coversPageBottom(userAgent)
    return {
        variant,
        experimentId: experiment.id,
        // Made per request and rendered once, on the server: the engine's route is a server component.
        Page: (props) => createElement(Variant, { ...props, deviceOs: os, liftCta }),
        metadata: { title: experiment.title },
    }
}
