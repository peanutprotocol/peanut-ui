'use client'

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'

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

            <DocSection title="Colors" description="Color is semantic, not decorative.">
                <DocSection.Content>
                    <div className="flex items-center gap-4">
                        <IconBubble icon="check" color="green" />
                        <IconBubble icon="ban" color="red" />
                        <IconBubble icon="alert" color="yellow" />
                        <IconBubble icon="clock" color="gray" />
                        <IconBubble icon="info" color="blue" />
                    </div>
                    <DesignNote type="info">
                        Yellow is for warnings only (a caution the user should read before acting). Red is an error,
                        green a success, blue plain information or a neutral method/action icon. Gray is inactive.
                        ActionModal exposes the same mapping as its <code>tone</code> prop.
                    </DesignNote>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Colors" code={`<IconBubble icon="ban" color="red" />`} />
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
