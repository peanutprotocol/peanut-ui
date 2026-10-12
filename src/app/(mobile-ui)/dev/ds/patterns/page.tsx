import { TierCatalog } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'

export default function PatternsPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-heading-m">Patterns</h1>
                <p className="mt-1 text-body-s text-foreground-secondary">
                    Start here. Composed components and layouts that cover most screens, built from primitives and
                    Global shared components.
                </p>
            </div>

            <TierCatalog tier="patterns" />
        </DocPage>
    )
}
