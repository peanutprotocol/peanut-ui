import { CatalogCard, CatalogGrid } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'

export default function PrimitivesPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-h3">Primitives</h1>
                <p className="mt-1 text-sm text-grey-1">
                    Bruddle base components. The lowest-level building blocks of the UI.
                </p>
            </div>

            <CatalogGrid>
                <CatalogCard
                    title="Button"
                    description="Primary interaction component. 7 variants, 3 sizes, shadow options, long-press support"
                    href="/dev/ds/primitives/button"
                    icon="switch"
                    status="production"
                    quality={4}
                    usages={120}
                />
                <CatalogCard
                    title="Card"
                    description="Container with optional shadow. Compound component with Header, Title, Description, Content"
                    href="/dev/ds/primitives/card"
                    icon="docs"
                    status="production"
                    quality={4}
                />
                <CatalogCard
                    title="BaseInput"
                    description="Text input with sm/md/lg variants and optional right content slot"
                    href="/dev/ds/primitives/base-input"
                    icon="clip"
                    status="production"
                    quality={3}
                />
                <CatalogCard
                    title="BaseSelect"
                    description="Radix-based dropdown select with error and disabled states"
                    href="/dev/ds/primitives/base-select"
                    icon="clip"
                    status="production"
                    quality={4}
                />
                <CatalogCard
                    title="Checkbox"
                    description="Simple checkbox with optional label"
                    href="/dev/ds/primitives/checkbox"
                    icon="check"
                    status="production"
                    quality={3}
                />
                <CatalogCard
                    title="Toast"
                    description="Context-based toast notification system. 4 types, auto-dismiss"
                    href="/dev/ds/primitives/toast"
                    icon="bell"
                    status="production"
                    quality={5}
                />
                <CatalogCard
                    title="Divider"
                    description="Horizontal divider with optional text label"
                    href="/dev/ds/primitives/divider"
                    icon="minus-circle"
                    status="production"
                />
                <CatalogCard
                    title="Title"
                    description="Knerd display font with filled/outline double-render effect"
                    href="/dev/ds/primitives/title"
                    icon="docs"
                    status="production"
                    quality={3}
                />
                <CatalogCard
                    title="PageContainer"
                    description="Responsive page wrapper with max-width and alignment options"
                    href="/dev/ds/primitives/page-container"
                    icon="docs"
                    status="production"
                />
            </CatalogGrid>
        </DocPage>
    )
}
