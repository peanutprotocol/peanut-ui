import { CatalogCard, CatalogGrid } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'

export default function PlaygroundPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-h3">Playground</h1>
                <p className="mt-1 text-body-s text-foreground-secondary">
                    Interactive test harnesses for motion, haptics, confetti and share assets. These are standalone
                    pages under{' '}
                    <code className="rounded-sm bg-foreground-primary/10 px-1 font-mono text-body-xs">/dev</code> (not
                    part of the doc-site chrome) — opening one navigates away from the design-system nav.
                </p>
            </div>

            <CatalogGrid>
                <CatalogCard
                    title="Shake & Confetti"
                    description="Tune shake intensity + hold-to-claim progress and fire the double-star confetti burst."
                    href="/dev/shake-test"
                    icon="gift"
                />
                <CatalogCard
                    title="Perk Success"
                    description="The perk-unlock success screen with mock perks — preview the celebration + confetti flow."
                    href="/dev/perk-success-test"
                    icon="check-circle"
                />
                <CatalogCard
                    title="Share Builder"
                    description="Iterator for the D3 card-waitlist share asset — stress-test tiers, names and edge cases."
                    href="/dev/share-builder"
                    icon="copy"
                />
            </CatalogGrid>
        </DocPage>
    )
}
