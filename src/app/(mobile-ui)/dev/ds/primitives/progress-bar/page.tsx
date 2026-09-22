'use client'

import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

export default function ProgressBarPage() {
    return (
        <DocPage>
            <DocHeader
                title="ProgressBar"
                description="Track + fill + optional tick markers. Consumers own their colors via token classes (no figma board — code-only primitive)."
                status="production"
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
                    description="Completion of the onboarding checklist, with the percentage spelled out above the bar."
                    code={`<div className="flex items-center justify-between text-body-s text-foreground-secondary">
    <span>{progressLabel}</span>
    <span>{completionPercent}%</span>
</div>
<ProgressBar value={completionPercent} fillClassName="bg-background-icon-bubble-green" />`}
                >
                    {/* the real file pairs the two with a 6px gap; the showcase
                        uses the on-scale step so the recreation does not add a
                        second off-scale spacing site to the ds-lint ratchet */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-body-s text-foreground-secondary">
                            <span>2 of 3 done</span>
                            <span>67%</span>
                        </div>
                        <ProgressBar value={67} fillClassName="bg-background-icon-bubble-green" />
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Pots — goal progress"
                    path="src/components/User/PotProgress.tsx"
                    description="The only marker consumer: a tick at the goal and a second one at the end when a closed pot went over it."
                    code={`<ProgressBar
    value={isOverGoal ? goalPercentage : progressPercentage}
    trackClassName={getTrackColor()}
    fillClassName="bg-green-500"
    markers={getMarkers()}
/>`}
                >
                    <ProgressBar
                        value={80}
                        fillClassName="bg-green-500"
                        markers={[
                            { position: 80, className: 'bg-green-500' },
                            { position: 'end', className: 'bg-action-secondary' },
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
