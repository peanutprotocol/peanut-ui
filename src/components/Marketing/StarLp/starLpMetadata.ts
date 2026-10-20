import type { Metadata } from 'next'
import { generateMetadata as generateMeta } from '@/app/metadata'
import type { StarLpMetadataInput } from './starLp.types'

const BRAND_SUFFIX = / \| Peanut$/

/**
 * Page metadata for a star LP: canonical path, the generated marketing OG card
 * (so a shared link shows the page's promise, not the generic site card), plus
 * noindex/nofollow until Konrad approves indexing.
 */
export function starLpMetadata({ title, description, path, ogTitle, ogSubtitle }: StarLpMetadataInput): Metadata {
    return {
        ...generateMeta({
            title,
            description,
            canonical: path,
            dynamicOg: true,
            ogTitle: ogTitle ?? title.replace(BRAND_SUFFIX, ''),
            ogSubtitle,
        }),
        robots: { index: false, follow: false },
    }
}
