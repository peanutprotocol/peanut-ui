'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Icon } from '@/components/Global/Icons/Icon'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

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

            <SectionDivider />

            <ProductUsage>
                <ProductUsage.Example
                    title="Backup — passkey FAQ"
                    path="src/app/(mobile-ui)/profile/backup/page.tsx"
                    description="Three plain rows, each opening a drawer. No positions in the call site — ListGroup derives them."
                    code={`<ListGroup>
  <ListItem title={t('faq.losePhone')} chevron onClick={() => setActiveModal('lose-phone')} />
  <ListItem title={t('faq.changePhone')} chevron onClick={() => setActiveModal('change-phone')} />
  <ListItem title={t('faq.exportKeys')} chevron onClick={() => setActiveModal('export-keys')} />
</ListGroup>`}
                >
                    <ListGroup>
                        <ListItem title="What if I lose my phone?" chevron onClick={() => {}} />
                        <ListItem title="What if I change phone?" chevron onClick={() => {}} />
                        <ListItem title="Can I export my keys?" chevron onClick={() => {}} />
                    </ListGroup>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Home — getting started checklist"
                    path="src/components/Home/GettingStartedChecklist.tsx"
                    description="Rows come from a map, so the group renumbers when a step drops out. Done rows are disabled and carry a Badge in the trailing slot."
                    code={`<ListGroup className="bg-background-default">
  {items.map((item) => (
    <ListItem
      key={item.id}
      leading={<IconBubble icon={item.icon} size="xs" color="yellow" />}
      title={item.label}
      body={showSub ? item.sub : undefined}
      trailing={item.done ? <Badge status="completed" /> : undefined}
      bodyWrap
      chevron={tappable}
      disabled={!tappable}
      onClick={tappable ? item.onTap : undefined}
    />
  ))}
</ListGroup>`}
                >
                    <ListGroup className="bg-background-default">
                        <ListItem
                            leading={<IconBubble icon="user-plus" size="xs" color="yellow" />}
                            title="Create your account"
                            trailing={<Icon name="check" size={16} />}
                            disabled
                        />
                        <ListItem
                            leading={<IconBubble icon="arrow-down" size="xs" color="yellow" />}
                            title="Add money"
                            body="Bank transfer, card or crypto"
                            bodyWrap
                            chevron
                            onClick={() => {}}
                        />
                    </ListGroup>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
