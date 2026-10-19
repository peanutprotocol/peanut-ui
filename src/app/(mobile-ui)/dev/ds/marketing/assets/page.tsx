'use client'

import Image from 'next/image'
import { Card } from '@/components/0_Bruddle/Card'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { COLOR_TOKENS } from '../../foundations/tokens.generated'
import { DOODLE_ENTRIES, GLOVE_ENTRIES, MASCOT_ENTRIES } from './assets-data'

const tokenValue = (name: string) => COLOR_TOKENS.find((t) => t.name === name)?.value ?? '—'

export default function MarketingAssetsPage() {
    return (
        <DocPage>
            <DocHeader
                title="Assets"
                description="The approved brand art: the 10 mascot poses, the doodles, and the gloves — each with its direction, fills and call sites. An asset that is not on this page is not approved."
            />

            <DesignNote type="info">
                Every mascot pose is on the brand tokens{' '}
                <code className="font-mono">action-secondary {tokenValue('action-secondary')}</code> /{' '}
                <code className="font-mono">action-primary {tokenValue('action-primary')}</code>, generated from the
                canonical set in mono/assets — recolour at the source, or the next re-export reverts the fixed files.
                Pink sneakers are canon across the whole set. A new brand asset needs Konrad&apos;s approval before it
                joins this page: send the asset plus a screenshot of the whole screen it will sit on (design.md §
                assets).
            </DesignNote>

            {/* Mascot gallery */}
            <DocSection
                title="Mascot poses"
                description="All 10 canonical Lotties, rendered through PeanutMascot (the juggling comp is out of brand and stays off this page)."
            >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {MASCOT_ENTRIES.map((entry) => (
                        <Card key={entry.pose} className="flex h-full flex-col items-center gap-2 p-3 text-center">
                            <div className="flex h-32 items-end justify-center">
                                <PeanutMascot pose={entry.pose} className="h-32" />
                            </div>
                            <p className="font-mono text-label-m">{entry.pose}</p>
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
                description="One four-point sparkle, brand yellow with a black outline; the other doodles are black or black and white."
            >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {DOODLE_ENTRIES.map((entry) => (
                        <Card key={entry.label} className="flex h-full flex-col gap-2 p-3">
                            <div className="flex h-16 items-center justify-center rounded-sm bg-background-page p-2">
                                <Image src={entry.asset} alt="" className="h-10 w-auto" />
                            </div>
                            <p className="font-mono text-label-m">{entry.label}</p>
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
            <DocSection title="Gloves" description="Flat white/black only, no grey shading.">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {GLOVE_ENTRIES.map((entry) => (
                        <Card key={entry.label} className="flex h-full flex-col gap-2 p-3">
                            <div className="flex h-16 items-center justify-center rounded-sm bg-background-page p-2">
                                <Image src={entry.asset} alt="" className="h-10 w-auto" />
                            </div>
                            <p className="font-mono text-label-m">{entry.label}</p>
                            <p className="font-mono text-body-xs text-foreground-secondary">{entry.fills}</p>
                            <p className="text-body-xs text-foreground-secondary">Used in: {entry.usedIn}</p>
                        </Card>
                    ))}
                </div>
            </DocSection>
        </DocPage>
    )
}
