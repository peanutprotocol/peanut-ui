import { TierCatalog } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'

export default function PlaygroundPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-heading-m">Playground</h1>
                <p className="mt-1 text-body-s text-foreground-secondary">
                    Interactive test harnesses for motion, haptics, confetti and share assets. These are standalone
                    pages under{' '}
                    <code className="rounded-sm bg-foreground-primary/10 px-1 font-mono text-body-xs">/dev</code> (not
                    part of the doc-site chrome) — opening one navigates away from the design-system nav.
                </p>
            </div>

            <TierCatalog tier="playground" />
        </DocPage>
    )
}
