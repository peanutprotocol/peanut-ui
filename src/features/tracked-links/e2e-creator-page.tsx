import type { CreatorPageSelection } from '@/features/creator-pages/registry'
import type { CreatorPageProps } from './contract'

// Only the lookup stub of e2e/flows/go-links.spec.ts answers these link ids; real ids are hashes.
const E2E_LINK_ID = `invite_${'e'.repeat(64)}`
const E2E_BROKEN_LINK_ID = `invite_${'f'.repeat(64)}`

function E2eCreatorPage({ ctaHref }: CreatorPageProps) {
    return <a href={ctaHref}>{'Get Peanut'}</a>
}

/** The engine's own test pages, so the /go flow is testable before any creator has a page. */
export function e2eCreatorPage(linkId: string): CreatorPageSelection | null {
    if (process.env.GO_LINKS_E2E_PAGE !== '1') return null
    if (linkId === E2E_LINK_ID) return { variant: 'e2e', experimentId: 'e2e', Page: E2eCreatorPage }
    // A page that throws while it renders: the visitor must still reach the handoff.
    if (linkId === E2E_BROKEN_LINK_ID)
        return {
            variant: 'e2e-broken',
            experimentId: 'e2e',
            Page: () => {
                throw new Error('e2e creator page failure')
            },
        }
    return null
}
