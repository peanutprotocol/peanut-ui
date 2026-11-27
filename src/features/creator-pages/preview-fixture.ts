import { creatorPageExperiment } from './experiments'
import type { CreatorPageProps } from './types'

/** Props for the preview route and the tests: what /c/<username> passes for this variant. */
export function creatorPageFixture(username: string, variant: string): CreatorPageProps {
    return { username, experimentId: creatorPageExperiment(username)?.id ?? 'preview', variant }
}
