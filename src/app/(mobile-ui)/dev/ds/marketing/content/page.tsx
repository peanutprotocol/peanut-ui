import { ViewportFrame } from '@/app/dev/ds-marketing-preview/_components/ViewportFrame'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { CONTENT_DEMOS } from './content-data'

export default function MarketingContentPage() {
    return (
        <DocPage>
            <DocHeader
                title="Content"
                description="The content-page chrome (rulings of 2026-10-14/15): the plain pink hero on every content page, the single-heading FAQ, the plain-token table, the 24px gutter with the 640 prose measure, and the marketing page header."
            />

            <DesignNote type="warning">
                Structure rules live in content/_system/guidelines/components.md — this page is VISUAL only. What goes
                on a content page, in which order and with which copy belongs there; this page pins how each piece
                looks.
            </DesignNote>

            <DesignNote type="info">
                Every framed demo renders the real components in an iframe at a TRUE viewport width — toggle Phone 390 /
                Desktop 1440 on each frame. Tablet is explicitly ignored: the rulings pin phone and desktop, and between
                them the bands interpolate.
            </DesignNote>

            {CONTENT_DEMOS.map((entry) => (
                <DocSection key={entry.demo} title={entry.title} description={entry.rule}>
                    <ViewportFrame demo={entry.demo} label={entry.title} heights={entry.heights} />
                    {entry.pending && <p className="text-label-m text-foreground-secondary">{entry.pending}</p>}
                </DocSection>
            ))}
        </DocPage>
    )
}
