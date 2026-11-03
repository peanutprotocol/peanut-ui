'use client'

import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'

export default function ProgressBarPage() {
    return (
        <DocPage>
            <DocHeader
                title="ProgressBar"
                description="Track + fill + optional tick markers. Consumers own their colors via token classes (no figma board — code-only primitive)."
                status="production"
            />

            <WhenToUse
                use={[
                    'Show how far a known quantity has run — checklist completion, pot goal, remaining limit',
                    'Mark a threshold on the track with markers — the goal tick on a pot',
                    'Pass the tone through trackClassName and fillClassName token classes; the bar owns no color',
                    'Pair the bar with the percentage or the count spelled out above it',
                ]}
                dontUse={[
                    'Waiting with no known end — use Loading (CyclingLoading stays inline)',
                    'Page or step position — use CarouselDots',
                    'Hold-to-confirm feedback — Button longPress draws its own bar',
                ]}
            />

            <DocSection title="Values">
                <DocSection.Content>
                    <div className="flex flex-col gap-4">
                        <ProgressBar value={25} />
                        <ProgressBar value={60} fillClassName="bg-background-icon-bubble-green" />
                        <ProgressBar value={100} fillClassName="bg-background-icon-bubble-green" />
                        <ProgressBar
                            value={45}
                            fillClassName="bg-background-icon-bubble-green"
                            markers={[{ position: 75, className: 'bg-background-icon-bubble-green' }]}
                        />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="ProgressBar"
                        code={`import ProgressBar from '@/components/0_Bruddle/ProgressBar'

<ProgressBar value={60} fillClassName="bg-background-icon-bubble-green" />
<ProgressBar value={45} markers={[{ position: 75, className: 'bg-background-icon-bubble-green' }]} />`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Home — getting started checklist"
                    path="src/components/Home/GettingStartedChecklist.tsx"
                    description="Completion of the onboarding checklist, with the count spelled out above the bar, in the list's top card."
                    code={`<div className="flex flex-col gap-2">
    <span className="text-body-s text-foreground-secondary">{t('progress', { done, total })}</span>
    <ProgressBar value={completionPercent} fillClassName="bg-background-icon-bubble-green" />
</div>`}
                >
                    <div className="flex flex-col gap-2">
                        <span className="text-body-s text-foreground-secondary">1 of 4 done</span>
                        <ProgressBar value={25} fillClassName="bg-background-icon-bubble-green" />
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Pots — goal progress"
                    path="src/components/User/PotProgress.tsx"
                    description="The only marker consumer: a tick at the goal and a second one at the end when a closed pot went over it."
                    code={`<ProgressBar
    value={isOverGoal ? goalPercentage : progressPercentage}
    trackClassName={getTrackColor()}
    fillClassName="bg-background-icon-bubble-green"
    markers={getMarkers()}
/>`}
                >
                    <ProgressBar
                        value={80}
                        fillClassName="bg-background-icon-bubble-green"
                        markers={[
                            { position: 80, className: 'bg-background-icon-bubble-green' },
                            { position: 'end', className: 'bg-background-accent-yellow' },
                        ]}
                    />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Limits — remaining allowance"
                    path="src/features/limits/views/MantecaLimitsView.tsx"
                    description="The fill color is derived from the remaining percent, so the bar turns red as the limit runs out."
                    code={`<ProgressBar value={remainingPercent} fillClassName={getLimitColorClass(remainingPercent, 'bg')} />`}
                >
                    <ProgressBar value={18} fillClassName="bg-red-200" />
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
