import { CatalogCard, CatalogGrid } from '../_components/CatalogCard'
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

            <CatalogGrid>
                <CatalogCard
                    title="Colors"
                    description="Semantic tokens, legacy palettes, and color usage rules"
                    href="/dev/ds/foundations/colors"
                    icon="bulb"
                    status="production"
                />
                <CatalogCard
                    title="Typography"
                    description="Font families, weights, text sizes, and the Knerd display font"
                    href="/dev/ds/foundations/typography"
                    icon="docs"
                    status="production"
                />
                <CatalogCard
                    title="Spacing"
                    description="Spacing scale, layout utilities (.row, .col), and gap conventions"
                    href="/dev/ds/foundations/spacing"
                    icon="switch"
                    status="production"
                />
                <CatalogCard
                    title="Shadows"
                    description="Shadow tokens and visual comparison. shadowSize=4 is the standard"
                    href="/dev/ds/foundations/shadows"
                    icon="docs"
                    status="production"
                />
                <CatalogCard
                    title="Icons"
                    description="85+ material design icons with searchable grid and copy-to-clipboard"
                    href="/dev/ds/foundations/icons"
                    icon="search"
                    status="production"
                    quality={4}
                />
                <CatalogCard
                    title="Borders"
                    description="Border radius and semantic border styles"
                    href="/dev/ds/foundations/borders"
                    icon="docs"
                    status="production"
                />
                <CatalogCard
                    title="Motion & haptics"
                    description="Duration and easing tokens, reduced motion, and native feedback primitives"
                    href="/dev/ds/foundations/motion-haptics"
                    icon="meter"
                    status="limited"
                />
            </CatalogGrid>
        </DocPage>
    )
}
