'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Icon } from '@/components/Global/Icons/Icon'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

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
                        <ListItem title="Top row" position="top" chevron onClick={() => {}} />
                        <ListItem title="Middle row" position="middle" chevron onClick={() => {}} />
                        <ListItem title="Bottom row" position="bottom" chevron onClick={() => {}} />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Grouped"
                        code={`<ListItem title="Top" position="top" />
<ListItem title="Middle" position="middle" />
<ListItem title="Bottom" position="bottom" />`}
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
                        type: "'solo' | 'top' | 'middle' | 'bottom'",
                        default: "'solo'",
                        description: 'Grouped-list borders/radius',
                    },
                    {
                        name: 'disabled',
                        type: 'boolean',
                        default: 'false',
                        description: 'disabled fill + subtle border + secondary title, no onClick',
                    },
                    { name: 'onClick', type: '() => void', default: '(none)' },
                ]}
            />

            <SectionDivider />

            <ProductUsage>
                <ProductUsage.Example
                    title="Withdraw — crypto row above the currency list"
                    path="src/features/withdraw/components/WithdrawCurrencyList.tsx"
                    description="Solo row with an icon bubble, a wrapping body line and a chevron. It sits beside the currencies, never inside them."
                    code={`<ListItem
  key="crypto"
  title={tGlobal('countryList.cryptoWithdrawTitle')}
  body={tGlobal('countryList.cryptoWithdrawDescription')}
  bodyWrap
  chevron
  leading={<IconBubble icon="coins" color="blue" size="s" />}
  onClick={onCryptoClick}
  data-testid="withdraw-crypto"
/>`}
                >
                    <ListItem
                        title="Crypto"
                        body="Send USDC to any wallet or exchange address"
                        bodyWrap
                        chevron
                        leading={<IconBubble icon="coins" color="blue" size="s" />}
                        onClick={() => {}}
                    />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Your card — management rows"
                    path="src/components/Card/YourCardScreen.tsx"
                    description="Plain Icon in the leading slot (no bubble), chevron, each row pushes a route."
                    code={`<ListItem
  title={t('pin')}
  leading={<Icon name="more-horizontal" size={24} />}
  chevron
  onClick={() => router.push('/card/pin')}
/>`}
                >
                    <div>
                        <ListItem
                            title="PIN"
                            leading={<Icon name="more-horizontal" size={24} />}
                            chevron
                            position="top"
                            onClick={() => {}}
                        />
                        <ListItem
                            title="Spending limit"
                            leading={<Icon name="meter" size={24} />}
                            chevron
                            position="bottom"
                            onClick={() => {}}
                        />
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
