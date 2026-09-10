'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function ListGroupPage() {
    return (
        <DocPage>
            <DocHeader
                title="ListGroup"
                description="Assigns first/middle/last/single positions to ListItem/Card children — no more hardcoded position literals. Code-only recipe (no figma board)."
                status="production"
            />

            <SectionDivider />

            <DocSection title="Examples">
                <DocSection.Content>
                    <ListGroup>
                        <ListItem title="First row" chevron onClick={() => {}} />
                        <ListItem title="Middle row" chevron onClick={() => {}} />
                        <ListItem title="Last row" chevron onClick={() => {}} />
                    </ListGroup>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { ListGroup } from '@/components/0_Bruddle/ListGroup'`} />
                    <CodeBlock
                        label="Positions are derived, conditionals renumber"
                        code={`<ListGroup>
  <ListItem title="A" />
  {showB && <ListItem title="B" />}
  <ListItem title="C" />
</ListGroup>`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
