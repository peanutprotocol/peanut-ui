import { CatalogCard, CatalogGrid } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'

export default function PatternsPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-h3">Patterns</h1>
                <p className="mt-1 text-sm text-grey-1">
                    Composed components and layout patterns built from primitives and Global shared components.
                </p>
            </div>

            <CatalogGrid>
                <CatalogCard
                    title="Modal"
                    description="Base Modal + ActionModal + specialized modals (14 total)"
                    href="/dev/ds/patterns/modal"
                    icon="link"
                    status="production"
                    quality={4}
                />
                <CatalogCard
                    title="Drawer"
                    description="Vaul-based bottom sheet with compound component API"
                    href="/dev/ds/patterns/drawer"
                    icon="link"
                    status="production"
                    quality={5}
                />
                <CatalogCard
                    title="Navigation"
                    description="NavHeader and FlowHeader for screen navigation"
                    href="/dev/ds/patterns/navigation"
                    icon="link"
                    status="production"
                    quality={4}
                />
                <CatalogCard
                    title="Loading"
                    description="CSS spinner (Loading) and branded animation (PeanutLoading)"
                    href="/dev/ds/patterns/loading"
                    icon="processing"
                    status="production"
                    quality={4}
                />
                <CatalogCard
                    title="Feedback"
                    description="StatusBadge, StatusPill, ErrorAlert, EmptyState, NoDataEmptyState"
                    href="/dev/ds/patterns/feedback"
                    icon="meter"
                    status="production"
                    quality={4}
                />
                <CatalogCard
                    title="Copy & Share"
                    description="CopyField, CopyToClipboard, ShareButton, AddressLink"
                    href="/dev/ds/patterns/copy-share"
                    icon="copy"
                    status="production"
                    quality={4}
                />
                <CatalogCard
                    title="Layouts"
                    description="Page layout recipes: centered CTA, pinned footer, scrollable list"
                    href="/dev/ds/patterns/layouts"
                    icon="switch"
                    status="production"
                    quality={4}
                />
                <CatalogCard
                    title="Cards (Global)"
                    description="Global Card for stacked lists with position-aware borders"
                    href="/dev/ds/patterns/cards-global"
                    icon="docs"
                    status="production"
                    quality={4}
                />
                <CatalogCard
                    title="AmountInput"
                    description="Large currency input with conversion, slider, balance display"
                    href="/dev/ds/patterns/amount-input"
                    icon="dollar"
                    status="needs-refactor"
                    quality={3}
                />
            </CatalogGrid>
        </DocPage>
    )
}
