import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'

// stub so the Marketing nav never 404s — a sibling branch of this run fills it
export default function MarketingContentPage() {
    return (
        <DocPage>
            <DocHeader
                title="Content"
                description="The one content hero (ruled 2026-10-15, q4): the plain pink mdx Hero opens every content page — compare, send-to, pricing, help — and the blog gains it too."
                status="limited"
            />
            <DesignNote type="info">
                Stub page. The content-page chrome — mdx hero, prose containers, the marketing strip (back circle +
                locale switcher) on every non-landing page — lands in ds-marketing-heroes. This page exists so the
                Marketing nav ships whole.
            </DesignNote>
        </DocPage>
    )
}
