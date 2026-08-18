'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'

export default function ListItemPage() {
    return (
        <DocPage>
            <DocHeader
                title="ListItem"
                description="Row component from the figma list-item board (17802:61530). Leading slot + title/body + trailing slot, grouped via position."
                status="production"
            />

            <DocSection title="Leading Content" description="Icon, icon bubble, or nothing — title with optional body.">
                <DocSection.Content>
                    <div className="space-y-4">
                        <ListItem title="Your Badges" chevron onClick={() => {}} />
                        <ListItem
                            title="Your Badges"
                            body="3 badges earned"
                            leading={<IconBubble icon="check" size="s" color="yellow" />}
                            chevron
                            onClick={() => {}}
                        />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="ListItem"
                        code={`<ListItem
  title="Your Badges"
  body="3 badges earned"
  leading={<IconBubble icon="check" size="s" color="yellow" />}
  chevron
  onClick={goToBadges}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection
                title="Grouped Positions"
                description="top / middle / bottom share borders like a stacked list."
            >
                <DocSection.Content>
                    <div>
                        <ListItem title="Top row" position="first" chevron onClick={() => {}} />
                        <ListItem title="Middle row" position="middle" chevron onClick={() => {}} />
                        <ListItem title="Bottom row" position="last" chevron onClick={() => {}} />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Grouped"
                        code={`<ListItem title="Top" position="first" />
<ListItem title="Middle" position="middle" />
<ListItem title="Bottom" position="last" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="Trailing Content & States">
                <DocSection.Content>
                    <div className="space-y-4">
                        <ListItem
                            title="Payment to Booking…"
                            body="Pay"
                            leading={<IconBubble icon="arrow-up" size="s" color="yellow" />}
                            trailing={<span className="text-body-m-semibold">$249</span>}
                            onClick={() => {}}
                        />
                        <ListItem title="Disabled row" body="Not interactive" disabled chevron />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Trailing value"
                        code={`<ListItem title="Payment" trailing={<span>$249</span>} />`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'title', type: 'ReactNode', default: '(required)' },
                    { name: 'body', type: 'ReactNode', default: '(none)', description: 'Secondary line' },
                    {
                        name: 'leading',
                        type: 'ReactNode',
                        default: '(none)',
                        description: 'IconBubble / Icon / avatar',
                    },
                    { name: 'trailing', type: 'ReactNode', default: '(none)', description: 'Value, toggle, badge' },
                    { name: 'chevron', type: 'boolean', default: 'false', description: 'Trailing nav chevron' },
                    {
                        name: 'position',
                        type: "'single' | 'first' | 'middle' | 'last'",
                        default: "'single'",
                        description: 'Grouped-list borders/radius',
                    },
                    { name: 'disabled', type: 'boolean', default: 'false', description: '40% opacity, no onClick' },
                    { name: 'onClick', type: '() => void', default: '(none)' },
                ]}
            />
        </DocPage>
    )
}
