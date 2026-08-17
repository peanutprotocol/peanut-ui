import { CatalogCard, CatalogGrid } from '../_components/CatalogCard'
import { DocPage } from '../_components/DocPage'

export default function PlaygroundPage() {
    return (
        <DocPage>
            <div>
                <h1 className="text-h3">Playground</h1>
                <p className="mt-1 text-sm text-grey-1">
                    Interactive test harnesses for motion, haptics, confetti and share assets. These are standalone
                    pages under <code className="rounded bg-n-1/10 px-1 font-mono text-[11px]">/dev</code> (not part of
                    the doc-site chrome) — opening one navigates away from the design-system nav.
                </p>
            </div>

            <CatalogGrid>
                <CatalogCard
                    title="Shake & Confetti"
                    description="Tune shake intensity + hold-to-claim progress and fire the double-star confetti burst."
                    href="/dev/shake-test"
                    icon="gift"
                    status="production"
                />
                <CatalogCard
                    title="Perk Success"
                    description="The perk-unlock success screen with mock perks — preview the celebration + confetti flow."
                    href="/dev/perk-success-test"
                    icon="check-circle"
                    status="production"
                />
                <CatalogCard
                    title="Share Builder"
                    description="Iterator for the D3 card-waitlist share asset — stress-test tiers, names and edge cases."
                    href="/dev/share-builder"
                    icon="copy"
                    status="production"
                />
            </CatalogGrid>
        </DocPage>
    )
}
