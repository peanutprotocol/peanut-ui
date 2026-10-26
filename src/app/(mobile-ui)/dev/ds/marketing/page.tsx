import { TierCatalog } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'

export default function MarketingPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-heading-m">Marketing</h1>
                <p className="mt-1 text-body-s text-foreground-secondary">
                    What to use on landing and content pages. Brand: the tokens and type. Knerd: display lettering and
                    hero animation. Assets: the art you may use. Landing and Content: the page recipes, rendered at 390
                    and 1440. The long form is design.md § marketing.
                </p>
            </div>

            <TierCatalog tier="marketing" />
        </DocPage>
    )
}
