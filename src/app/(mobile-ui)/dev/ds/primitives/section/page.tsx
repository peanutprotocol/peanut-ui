'use client'

import { Section } from '@/components/0_Bruddle/Section'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function SectionPage() {
    return (
        <DocPage>
            <DocHeader
                title="Section"
                description="Section title above a list/card stack. Owns the heading token. Code-only recipe (no figma board)."
                status="production"
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'title', type: 'ReactNode', default: '(none)', description: 'h2 in text-heading-card' },
                    {
                        name: 'trailing',
                        type: 'ReactNode',
                        default: '(none)',
                        description:
                            'right-aligned action on the title row (a LinkButton, a count). Sibling of the h2, never inside it, so the heading keeps the title as its accessible name.',
                    },
                ]}
            />

            <DocSection title="Examples">
                <DocSection.Content>
                    <Section title="Unlocked regions">
                        <ListGroup>
                            <ListItem title="Argentina" chevron onClick={() => {}} />
                            <ListItem title="Europe" chevron onClick={() => {}} />
                        </ListGroup>
                    </Section>
                    <Section
                        title="Select a network"
                        trailing={<LinkButton onClick={() => {}}>More networks</LinkButton>}
                    >
                        <ListGroup>
                            <ListItem title="Arbitrum" chevron onClick={() => {}} />
                        </ListGroup>
                    </Section>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { Section } from '@/components/0_Bruddle/Section'`} />
                    <CodeBlock
                        label="Section with list"
                        code={`<Section title={t('unlockedRegions')}>
  <ListGroup>…</ListGroup>
</Section>`}
                    />
                    <CodeBlock
                        label="Section with a title-row action"
                        code={`<Section
  title={t('selectANetwork')}
  trailing={<LinkButton onClick={openList}>{t('moreNetworks')}</LinkButton>}
>
  <Tabs … />
</Section>`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
