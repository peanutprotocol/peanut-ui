import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'

// stub so the Marketing nav never 404s — a sibling branch of this run fills it
export default function MarketingLandingPage() {
    return (
        <DocPage>
            <DocHeader
                title="Landing"
                description="The two LP heroes (ruled 2026-10-15, q4): the key visual — Knerd Title + mascot + doodles on pink — leads the main LP (home, /lp); the /shhhhh-style product split (text left, product art right) is promoted to THE sub-LP hero for star-feature and campaign LPs."
                status="limited"
            />
            <DesignNote type="info">
                Stub page. The hero recipes, the extracted product-split hero component, and the fold catalog land in
                ds-marketing-heroes — this page exists so the Marketing nav ships whole.
            </DesignNote>
        </DocPage>
    )
}
