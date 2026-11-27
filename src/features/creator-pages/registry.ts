// How /c/<username> picks a page: mono engineering/ui/creator-pages.md
import { cookies, headers } from 'next/headers'
import type { ComponentType } from 'react'
import { coversPageBottom, deviceOs } from './environment'
import { creatorPageExperiment } from './experiments'
import { creatorPageLocale } from './locale'
import { creatorPageComponent } from './page-components'
import { pickVariant } from './pick-variant'
import { variantCookieName } from './variant-cookie'
import type { CreatorPageVariantProps } from './variant-props'

export type CreatorPageSelection = {
    Page: ComponentType<CreatorPageVariantProps>
    props: CreatorPageVariantProps
}

/**
 * Server only. `null` when the creator has no page (no experiment, or every weight 0). Everything a
 * page needs from the request is read here, so the page itself renders without waiting. Reads the
 * variant cookie and never sets it: Next forbids cookies().set during a page render, so
 * CreatorPageProvider writes it in the browser.
 */
export async function selectCreatorPage(username: string): Promise<CreatorPageSelection | null> {
    const experiment = creatorPageExperiment(username)
    if (!experiment) return null
    const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
    // One draw per request. A request that carries DNT or GPC gets a fresh pick even if an older
    // visit left the cookie; CreatorPageProvider then removes the cookie.
    const refusesTracking = requestHeaders.get('dnt') === '1' || requestHeaders.get('sec-gpc') === '1'
    const variant = pickVariant(
        experiment,
        refusesTracking ? null : cookieStore.get(variantCookieName(username))?.value
    )
    const Page = variant && creatorPageComponent(username, variant)
    if (!Page) return null

    // The visitors are on phones in in-app browsers, where hydration is slow. Deciding the OS here
    // puts the right label and store icon in the first HTML, so nothing changes under the thumb.
    // Presentation only: the events read the user agent in the browser.
    // The same goes for the lift of the bottom button where the in-app browser covers the page's bottom edge.
    const userAgent = requestHeaders.get('user-agent') ?? ''
    return {
        Page,
        props: {
            username,
            experimentId: experiment.id,
            variant,
            deviceOs: deviceOs(userAgent),
            liftCta: coversPageBottom(userAgent),
            locale: creatorPageLocale(cookieStore, requestHeaders),
        },
    }
}
