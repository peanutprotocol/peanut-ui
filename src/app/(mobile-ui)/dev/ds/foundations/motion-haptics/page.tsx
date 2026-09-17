'use client'

import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Notification } from '@/components/0_Bruddle/Notification'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'

const DURATIONS = [
    ['duration-instant', '100ms', 'Press, hover, color, and state changes'],
    ['duration-fast', '200ms', 'Reveal, fade, and small layout shifts'],
    ['duration-moderate', '300ms', 'Expand, collapse, and drawer content'],
    ['duration-slow', '500ms', 'Page and sheet transitions'],
] as const

const HAPTICS = [
    ['impactHaptic', 'Light interaction feedback'],
    ['heavyImpactHaptic', 'Strong interaction feedback'],
    ['notifyHaptic', 'Success, warning, or error feedback'],
    ['vibrateHaptic', 'Explicit vibration pattern'],
    ['cancelHaptic', 'Stop active vibration'],
] as const

export default function MotionHapticsPage() {
    return (
        <DocPage>
            <DocHeader
                title="Motion & haptics"
                description="The current duration, easing, reduced-motion, and feedback rules from Mono design.md."
            />

            <Notification priority="attention" title="Draft guidance">
                The interaction-to-haptic mapping is not ruled yet. Match an existing flow and flag any new feedback
                pattern for a design decision.
            </Notification>

            <DocSection title="Duration tokens">
                <Card className="divide-y divide-dashed divide-border-default px-4">
                    {DURATIONS.map(([token, value, use]) => (
                        <DataRow key={token} label={token} value={`${value} · ${use}`} />
                    ))}
                </Card>
            </DocSection>

            <DocSection title="Easing and reduced motion">
                <Card className="divide-y divide-dashed divide-border-default px-4">
                    <DataRow label="ease-spring" value="Spring-like motion" />
                    <DataRow label="ease-sharp" value="Direct state change" />
                    <DataRow label="Decorative motion" value="Use motion-safe or useReducedMotion" />
                </Card>
            </DocSection>

            <DocSection title="Haptic primitives">
                <DocSection.Content>
                    <Card className="divide-y divide-dashed divide-border-default px-4">
                        {HAPTICS.map(([name, use]) => (
                            <DataRow key={name} label={name} value={use} />
                        ))}
                    </Card>
                    <LinkButton href="/dev/shake-test" icon>
                        Open the interaction playground
                    </LinkButton>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Haptic import"
                        code={`import { impactHaptic, notifyHaptic } from '@/utils/haptics'`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
