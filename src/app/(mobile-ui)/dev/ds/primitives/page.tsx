import { TierCatalog } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'

export default function PrimitivesPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-heading-m">Primitives</h1>
                <p className="mt-1 text-body-s text-foreground-secondary">
                    Building blocks. Start from Patterns: use a primitive directly only when no pattern fits the screen.
                </p>
            </div>

            <TierCatalog tier="primitives" />
        </DocPage>
    )
}
