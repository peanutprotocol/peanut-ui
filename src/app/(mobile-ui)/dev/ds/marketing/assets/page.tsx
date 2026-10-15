'use client'

import Image from 'next/image'
import { Card } from '@/components/0_Bruddle/Card'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { COLOR_TOKENS } from '../../foundations/tokens.generated'
import { DOODLE_ENTRIES, GLOVE_ENTRIES, MASCOT_ENTRIES, type DoodleStatus, type MascotStatus } from './assets-data'

const tokenValue = (name: string) => COLOR_TOKENS.find((t) => t.name === name)?.value ?? '—'

// one chip vocabulary for the whole inventory: green = done, yellow = ruled
// work that a fix branch still owes
function StatusChip({ status }: { status: MascotStatus | DoodleStatus }) {
    const done = status === 'on-brand' || status === 'canon'
    return (
        <span
            className={`rounded-full border border-border-default px-2 py-0.5 text-label-m ${
                done ? 'bg-background-icon-bubble-green text-foreground-inverse' : 'bg-action-secondary'
            }`}
        >
            {status}
        </span>
    )
}

export default function MarketingAssetsPage() {
    return (
        <DocPage>
            <DocHeader
                title="Assets"
                description="The marketing art inventory: the 10 mascot poses, the doodles, and the gloves — each with its ruled direction and recolour status (rulings of 2026-10-14/15)."
            />

            <DesignNote type="info">
                Ruled targets: every mascot pose on the brand tokens{' '}
                <code className="font-mono">action-secondary {tokenValue('action-secondary')}</code> /{' '}
                <code className="font-mono">action-primary {tokenValue('action-primary')}</code>, regenerated from the
                recoloured canonical set in mono/assets — recolour at the source, or the next re-export reverts the
                fixed files. Pink sneakers are canon across the whole set (k6). The recolours land in ds-marketing-art;
                the chips below show where each file stands today.
            </DesignNote>

            {/* Mascot gallery */}
            <DocSection
                title="Mascot poses"
                description="All 10 canonical Lotties, rendered through PeanutMascot (the juggling comp is out of brand — Hugo, 2026-10-10 — and stays off this page). Fills were re-verified against the shipped comps on this branch."
            >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {MASCOT_ENTRIES.map((entry) => (
                        <Card key={entry.pose} className="flex h-full flex-col items-center gap-2 p-3 text-center">
                            <div className="flex h-32 items-end justify-center">
                                <PeanutMascot pose={entry.pose} className="h-32" />
                            </div>
                            <p className="font-mono text-label-m">{entry.pose}</p>
                            <StatusChip status={entry.status} />
                            <p className="font-mono text-body-xs break-all text-foreground-secondary">
                                {entry.fills.join(' ')}
                            </p>
                            <p className="text-body-xs text-foreground-secondary">{entry.usedFor}</p>
                        </Card>
                    ))}
                </div>
            </DocSection>

            {/* Doodles */}
            <DocSection
                title="Doodles"
                description="Ruled direction (doodle-palette A): one four-point sparkle, brand yellow with a black outline. The near-miss yellows (each row names its own) go in the recolour branch."
            >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {DOODLE_ENTRIES.map((entry) => (
                        <Card key={entry.label} className="flex h-full flex-col gap-2 p-3">
                            <div className="flex h-16 items-center justify-center rounded-sm bg-background-page p-2">
                                <Image src={entry.asset} alt="" className="h-10 w-auto" />
                            </div>
                            <p className="font-mono text-label-m">{entry.label}</p>
                            <StatusChip status={entry.status} />
                            <p className="font-mono text-body-xs text-foreground-secondary">{entry.fills}</p>
                            <p className="text-body-xs text-foreground-secondary">Used in: {entry.usedIn}</p>
                        </Card>
                    ))}
                </div>
                <p className="font-mono text-body-xs text-foreground-secondary">
                    Files live under src/assets — referenced by path only, never opened here.
                </p>
            </DocSection>

            {/* Gloves */}
            <DocSection
                title="Gloves"
                description="Ruled direction (glove-style A): flat white/black only, no grey shading. The footer hand row currently shows both styles side by side on every page."
            >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {GLOVE_ENTRIES.map((entry) => (
                        <Card key={entry.label} className="flex h-full flex-col gap-2 p-3">
                            <div className="flex h-16 items-center justify-center rounded-sm bg-background-page p-2">
                                <Image src={entry.asset} alt="" className="h-10 w-auto" />
                            </div>
                            <p className="font-mono text-label-m">{entry.label}</p>
                            <StatusChip status={entry.status} />
                            <p className="font-mono text-body-xs text-foreground-secondary">{entry.fills}</p>
                            <p className="text-body-xs text-foreground-secondary">Used in: {entry.usedIn}</p>
                        </Card>
                    ))}
                </div>
            </DocSection>
        </DocPage>
    )
}
