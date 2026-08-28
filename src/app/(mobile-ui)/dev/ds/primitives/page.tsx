import { CatalogCard, CatalogGrid } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'
import { SIDEBAR_CONFIG } from '../_components/nav-config'

export default function PrimitivesPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-h3">Primitives</h1>
                <p className="mt-1 text-body-s text-foreground-secondary">
                    Bruddle base components. The lowest-level building blocks of the UI.
                </p>
            </div>

            {/* derived from nav-config (the sidebar's source) so the two can
                never disagree again — F-21; a drift test pins both to the
                filesystem */}
            <CatalogGrid>
                {SIDEBAR_CONFIG.primitives.map((item) => (
                    <CatalogCard
                        key={item.href}
                        title={item.label}
                        description={item.description ?? ''}
                        href={item.href}
                        icon={item.icon}
                        status={item.status ?? 'production'}
                    />
                ))}
            </CatalogGrid>
        </DocPage>
    )
}
