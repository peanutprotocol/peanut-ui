import { TierCatalog } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'

export default function FoundationsPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-heading-m">Foundations</h1>
                <p className="mt-1 text-body-s text-foreground-secondary">
                    Design tokens, visual primitives, and systemic building blocks.
                </p>
            </div>

            <TierCatalog tier="foundations" />
        </DocPage>
    )
}
