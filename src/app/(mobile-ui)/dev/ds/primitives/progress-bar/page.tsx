'use client'

import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

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
                        <ProgressBar value={60} fillClassName="bg-green-500" />
                        <ProgressBar value={100} fillClassName="bg-green-500" />
                        <ProgressBar
                            value={45}
                            fillClassName="bg-green-500"
                            markers={[{ position: 75, className: 'bg-green-500' }]}
                        />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="ProgressBar"
                        code={`import ProgressBar from '@/components/0_Bruddle/ProgressBar'

<ProgressBar value={60} fillClassName="bg-green-500" />
<ProgressBar value={45} markers={[{ position: 75, className: 'bg-green-500' }]} />`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
