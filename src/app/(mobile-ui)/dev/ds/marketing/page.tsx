import { TierCatalog } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'

export default function MarketingPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-heading-m">Marketing</h1>
                <p className="mt-1 text-body-s text-foreground-secondary">
                    The marketing surfaces&apos; design system: the live site is the brand (ruled 2026-10-14, Konrad).
                    Brand and Assets document the ratified reality; Landing and Content arrive in sibling branches.
                </p>
            </div>

            <TierCatalog tier="marketing" />
        </DocPage>
    )
}
