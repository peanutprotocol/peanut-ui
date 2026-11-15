import { goHandoffPath, type CreatorPageProps, type GoVisit } from '@/features/tracked-links/contract'
import { creatorPageExperiment } from './experiments'

/** Props for the dev preview and the tests only: what the /go engine passes for an Instagram visit. */
export function creatorPageFixture(username: string, variant: string): CreatorPageProps {
    const visit: GoVisit = {
        username,
        placement: 'ig',
        code: null,
        utm: { source: null, medium: null, campaign: null, content: null },
        referrerHost: 'l.instagram.com',
    }
    return {
        creator: { username, linkId: 'invite_' + '0'.repeat(64) },
        variant,
        // Built by the engine's own function, so the fixture cannot drift from a real handoff.
        ctaHref: goHandoffPath(visit, { variant, experimentId: creatorPageExperiment(username)?.id ?? 'preview' }),
        visit,
    }
}
