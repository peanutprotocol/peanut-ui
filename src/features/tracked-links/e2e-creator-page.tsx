import type { CreatorPageSelection } from '@/features/creator-pages/registry'
import type { CreatorPageProps } from './contract'

// Only the lookup stub of e2e/flows/go-links.spec.ts answers this link id; real ids are hashes.
const E2E_LINK_ID = `invite_${'e'.repeat(64)}`

function E2eCreatorPage({ ctaHref }: CreatorPageProps) {
    return <a href={ctaHref}>{'Get Peanut'}</a>
}

/** The engine's own test page, so the /go flow is testable before any creator has a page. */
export function e2eCreatorPage(linkId: string): CreatorPageSelection | null {
    if (process.env.GO_LINKS_E2E_PAGE !== '1' || linkId !== E2E_LINK_ID) return null
    return { variant: 'e2e', experimentId: 'e2e', Page: E2eCreatorPage }
}
