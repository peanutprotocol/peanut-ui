'use client'

import { useState } from 'react'
import SegmentedControl from '@/components/0_Bruddle/SegmentedControl'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function SegmentedControlPage() {
    const [period, setPeriod] = useState('week')
    const [network, setNetwork] = useState('evm')

    return (
        <DocPage>
            <DocHeader
                title="SegmentedControl"
                description="Radix tabs styled as a pill row — active segment gets the action-primary border + tint. For period toggles and network selectors, not content tabs. No figma board — code-only primitive."
                status="production"
            />

            <DocSection title="Compact & full width">
                <DocSection.Content>
                    <div className="flex flex-col gap-4">
                        <SegmentedControl
                            aria-label="period"
                            value={period}
                            onChange={setPeriod}
                            options={[
                                { value: 'day', label: 'Day' },
                                { value: 'week', label: 'Week' },
                                { value: 'month', label: 'Month' },
                            ]}
                        />
                        <SegmentedControl
                            aria-label="network"
                            fullWidth
                            value={network}
                            onChange={setNetwork}
                            options={[
                                { value: 'evm', label: 'EVM' },
                                { value: 'sol', label: 'Solana' },
                            ]}
                        />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="SegmentedControl"
                        code={`import SegmentedControl from '@/components/0_Bruddle/SegmentedControl'

<SegmentedControl
    value={period}
    onChange={setPeriod}
    options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]}
/>`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
