import { TierCatalog } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'

export default function PrimitivesPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-heading-m">Primitives</h1>
                <p className="mt-1 text-body-s text-foreground-secondary">
                    Bruddle base components. The lowest-level building blocks of the UI.
                </p>
            </div>

            <TierCatalog tier="primitives" />
        </DocPage>
    )
}
