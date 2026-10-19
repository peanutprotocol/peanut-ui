import { TierCatalog } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'

export default function MarketingPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-heading-m">Marketing</h1>
                <p className="mt-1 text-body-s text-foreground-secondary">
                    The marketing surfaces&apos; design system: the live site is the brand. Brand and Assets document
                    what ships; Landing and Content show the page recipes at true 390/1440 viewports.
                </p>
            </div>

            <TierCatalog tier="marketing" />
        </DocPage>
    )
}
