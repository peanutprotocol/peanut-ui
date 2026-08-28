'use client'

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'

export default function IconBubblePage() {
    return (
        <DocPage>
            <DocHeader
                title="IconBubble"
                description="Round colored icon container from the figma icon-bubble board (17802:61528)."
                status="production"
            />

            <DocSection title="Sizes" description="xs=24, s=32, m=48, l=72px.">
                <DocSection.Content>
                    <div className="flex items-end gap-4">
                        <IconBubble icon="check" size="xs" />
                        <IconBubble icon="check" size="s" />
                        <IconBubble icon="check" size="m" />
                        <IconBubble icon="check" size="l" />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Sizes" code={`<IconBubble icon="check" size="m" />`} />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Colors">
                <DocSection.Content>
                    <div className="flex items-center gap-4">
                        <IconBubble icon="check" color="green" />
                        <IconBubble icon="alert" color="red" />
                        <IconBubble icon="link" color="yellow" />
                        <IconBubble icon="clock" color="gray" />
                        <IconBubble icon="bell" color="blue" />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Colors" code={`<IconBubble icon="alert" color="red" />`} />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'icon', type: 'IconName | ReactNode', default: '(required)' },
                    { name: 'size', type: "'xs' | 's' | 'm' | 'l'", default: "'m'" },
                    {
                        name: 'color',
                        type: "'green' | 'red' | 'yellow' | 'gray' | 'blue'",
                        default: "'green'",
                    },
                ]}
            />
        </DocPage>
    )
}
