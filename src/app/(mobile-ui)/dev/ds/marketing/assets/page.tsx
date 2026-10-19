'use client'

import Image from 'next/image'
import { Card } from '@/components/0_Bruddle/Card'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { COLOR_TOKENS } from '../../foundations/tokens.generated'
import { DOODLE_ENTRIES, GLOVE_ENTRIES, HERO_ART_ENTRIES, MASCOT_ENTRIES, type ArtEntry } from './assets-data'

const tokenValue = (name: string) => COLOR_TOKENS.find((t) => t.name === name)?.value ?? '—'

function ArtGrid({ entries }: { entries: ArtEntry[] }) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {entries.map((entry) => (
                <Card key={entry.label} className="flex h-full flex-col gap-2 p-3">
                    <div className="flex h-16 items-center justify-center rounded-sm bg-background-page p-2">
                        <Image src={entry.asset} alt="" className="h-10 w-auto" />
                    </div>
                    <p className="font-mono text-label-m">{entry.label}</p>
                    <p className="font-mono text-body-xs break-all text-foreground-secondary">{entry.path}</p>
                    <p className="text-body-xs text-foreground-secondary">{entry.usedIn}</p>
                </Card>
            ))}
        </div>
    )
}

export default function MarketingAssetsPage() {
    return (
        <DocPage>
            <DocHeader
                title="Assets"
                description="The art you may put on a marketing surface. Not on this page = not approved."
            />

            <DesignNote type="warning">
                Need something new? Send Konrad the asset plus a screenshot of the whole screen it will sit on. Once
                approved, add it here, then use it.
            </DesignNote>

            <DocSection
                title="Mascot"
                description={`10 poses. Body ${tokenValue('action-secondary')}, sneakers and accents ${tokenValue('action-primary')}.`}
            >
                <DocSection.Content>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {MASCOT_ENTRIES.map((entry) => (
                            <Card key={entry.pose} className="flex h-full flex-col items-center gap-2 p-3 text-center">
                                <div className="flex h-32 items-end justify-center">
                                    <PeanutMascot pose={entry.pose} className="h-32" />
                                </div>
                                <p className="font-mono text-label-m">{entry.pose}</p>
                                <p className="text-body-xs text-foreground-secondary">{entry.usedFor}</p>
                            </Card>
                        ))}
                    </div>
                    <p className="text-body-s text-foreground-secondary">
                        Source files: mono/assets/mascot/lottie. Recolour there, never the export.
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="mascot"
                        code={`import PeanutMascot from '@/components/Global/PeanutMascot'\n\n<PeanutMascot pose="waving-chill" className="h-32" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection
                title="Hero artwork"
                description="The key visual is a Title lockup rendered to an image. Home and /lp only."
            >
                <ArtGrid entries={HERO_ART_ENTRIES} />
            </DocSection>

            <DocSection title="Doodles" description="Yellow with a black outline, or plain black.">
                <DocSection.Content>
                    <ArtGrid entries={DOODLE_ENTRIES} />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="doodle"
                        code={`import Sparkle from '@/assets/illustrations/sparkle.svg'\n\n<Image src={Sparkle} alt="" className="h-10 w-auto" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="Gloves" description="Flat white with a black outline. No shading.">
                <ArtGrid entries={GLOVE_ENTRIES} />
            </DocSection>
        </DocPage>
    )
}
