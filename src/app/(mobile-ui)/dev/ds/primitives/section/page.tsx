'use client'

import { useState } from 'react'
import { Section } from '@/components/0_Bruddle/Section'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { PropsTable } from '../../_components/PropsTable'
import { ProductUsage } from '../../_components/ProductUsage'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { WhenToUse } from '../../_components/WhenToUse'

export default function SectionPage() {
    // mirrors TokenSelector's activeNetworkTab state
    const [networkTab, setNetworkTab] = useState('all')

    return (
        <DocPage>
            <DocHeader
                title="Section"
                description="Section title above a list/card stack. Owns the heading token. Code-only recipe (no figma board)."
                status="production"
            />

            <WhenToUse
                use={[
                    'A titled block on a page: a heading over a list, a card stack, or a tabs row',
                    'Anywhere a page would respell the heading — Section owns the h2 and its text-heading-card token',
                    'An action on the title row — pass trailing, so it stays a sibling of the h2',
                    'One heading that stays put while its content loads, errors, or renders empty',
                ]}
                dontUse={[
                    'The page title above the content — use NavHeader',
                    'A title with a supporting line under it — use TitleBlock',
                    'A new heading size at the call site — Section owns the type token; never swap it',
                    'The gap between sections — the page stack owns the XL/24 section gap; Section only sets the S/8 title-to-list gap',
                ]}
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

            <ProductUsage>
                <ProductUsage.Example
                    title="Accounts & payments — ways to add money"
                    path="src/components/Profile/views/AccountsList.tsx"
                    description="The plain shape: heading, a secondary line, then the list. Section owns the h2 token so the page never respells it."
                    code={`<Section title={t('waysTitle')}>
    <p className="text-body-s text-foreground-secondary">{t('waysSubtitle')}</p>
    <ListGroup>{bankListItems(bankRows, onRowClick, isKycDegraded, t)}</ListGroup>
</Section>`}
                >
                    <Section title="Ways to add money">
                        <p className="text-body-s text-foreground-secondary">
                            Send from your bank account, or receive from anyone.
                        </p>
                        <ListGroup>
                            <ListItem title="Bank transfer" body="USD, EUR" chevron onClick={() => {}} />
                            <ListItem title="Pix" body="BRL" chevron onClick={() => {}} />
                        </ListGroup>
                    </Section>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Token selector — select a network"
                    path="src/components/Global/TokenSelector/TokenSelector.tsx"
                    description="The trailing slot: 'More networks' sits on the title row as a sibling of the h2, so the heading keeps the title as its accessible name. The wrapper reserves the link's full 44px hit area without stretching the row."
                    code={`<Section
    title={t('tokenSelector.selectANetwork')}
    trailing={
        <div className="flex min-h-11 shrink-0 items-center">
            <LinkButton onClick={handleSearchNetwork}>{t('tokenSelector.moreNetworksTitle')}</LinkButton>
        </div>
    }
>
    <div ref={attachTabsRow}>
        <Tabs
            aria-label={t('tokenSelector.selectANetwork')}
            value={activeNetworkTab}
            onValueChange={handleNetworkTabChange}
            tabs={networkTabs}
            fullWidth="stretch"
        />
    </div>
</Section>`}
                >
                    <Section
                        title="Select a network"
                        trailing={
                            <div className="flex min-h-11 shrink-0 items-center">
                                <LinkButton onClick={() => {}}>More networks</LinkButton>
                            </div>
                        }
                    >
                        <Tabs
                            aria-label="Select a network"
                            value={networkTab}
                            onValueChange={setNetworkTab}
                            tabs={[
                                { value: 'all', label: 'All' },
                                { value: 'arb', label: 'ARB' },
                                { value: 'eth', label: 'ETH' },
                            ]}
                            fullWidth="stretch"
                        />
                    </Section>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Home — activity feed"
                    path="src/components/Home/HomeHistory.tsx"
                    description="Section also carries the feed's own layout: the className sets the column width and tightens the gap. Same heading, whether the feed loads, errors, or is empty."
                    code={`<Section title={t('activity')} className="mx-auto mt-6 w-full gap-3 md:max-w-2xl">
    <EmptyState
        icon="alert"
        title={isNetworkError ? t('networkErrorTitle') : t('errorTitle')}
        description={isNetworkError ? t('networkErrorDescription') : t('errorDescription')}
    />
</Section>`}
                >
                    <Section title="Activity" className="mx-auto w-full gap-3 md:max-w-2xl">
                        <EmptyState
                            icon="alert"
                            title="Could not load your activity"
                            description="Check your connection and try again."
                        />
                    </Section>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
