'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { LIMITS } from '@/constants/query.consts'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Section } from '@/components/0_Bruddle/Section'
import { TABS_LOOK_KEYS, TABS_LOOK_NAMES, TabsLookProvider, type TabsLook } from '@/components/0_Bruddle/TabsLook'
import RhinoDepositView from '@/components/AddMoney/views/RhinoDeposit.view'
import { ContentLinkList } from '@/components/Marketing/ContentLanding'
import { HUB_WIDTH } from '@/components/Marketing/constants'
import { Tabs as MarketingTabs, TabPanel } from '@/components/Marketing/mdx/Tabs'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import MantecaLimitsView from '@/features/limits/views/MantecaLimitsView'
import ExplorerHeader from '@/features/payment-network-explorer/ExplorerHeader'
import FilterPanel from '@/features/payment-network-explorer/FilterPanel'
import DevPageShell from '../../_components/DevPageShell'
import { ProposalTabs } from '../_components/TabVariants'
import {
    CONTENT_ITEMS,
    CONTENT_STRINGS,
    EXPLORER_FILTERS,
    EXPLORER_RELATIONSHIPS,
    LIMITS_FIXTURE,
    RHINO_DEPOSIT,
} from './fixtures'

/**
 * /dev/tabs-proposals/surfaces — TASK-22707, the same 6 looks on the REAL screens.
 *
 * The sibling page compares the looks on abstract tab rows. This one mounts the
 * actual product and marketing components and re-skins each one six times, so
 * the comparison is "what does THIS screen become", not "what does a tab row
 * look like". Nothing is re-implemented here: every block below renders the
 * shipped component with fixture props, wrapped in a look provider that
 * `Tabs` / `SegmentedControl` read (see `0_Bruddle/TabsLook`).
 *
 * Product blocks are meant to be read at 375x667. The two marketing blocks are
 * meant to be read at ~1280 — that is where those pages are used.
 *
 * Nothing here ships. The winner is applied to `Tabs` in a separate PR and this
 * directory is deleted then.
 */

// ------------------------------------------------------------------ scaffolding

/** one surface rendered once per look, each block anchored for screenshotting */
const LookSet = ({ surface, children }: { surface: string; children: (look: TabsLook) => ReactNode }) => (
    <div className="flex flex-col gap-6">
        {TABS_LOOK_KEYS.map((look) => (
            <div key={look} id={`${surface}-${look}`} data-look-block className="flex flex-col gap-2">
                <p className="text-label-m text-foreground-secondary uppercase">{TABS_LOOK_NAMES[look]}</p>
                <div className="border border-border-subtle bg-background-default">
                    <TabsLookProvider look={look}>{children(look)}</TabsLookProvider>
                </div>
            </div>
        ))}
    </div>
)

/** a viewport-sized window on a full screen: the tab row and what sits under it */
const Viewport = ({ height = 'h-[560px]', children }: { height?: string; children: ReactNode }) => (
    <div className={`${height} overflow-hidden p-4`}>{children}</div>
)

const Note = ({ children }: { children: ReactNode }) => (
    <p className="text-body-s text-foreground-secondary">{children}</p>
)

const noop = () => {}

// -------------------------------------------------------------------- the page

export default function TabsSurfacesPage() {
    const queryClient = useQueryClient()

    // MantecaLimitsView reads useLimits(); prime the cache instead of mocking the
    // hook, so the REAL view renders its real loading/error/data branches. The
    // hook's 5-minute staleTime keeps refetchOnMount from replacing this.
    useState(() => queryClient.setQueryData([LIMITS], LIMITS_FIXTURE))

    const [chainType, setChainType] = useState<'EVM' | 'SOL' | 'TRON'>('EVM')

    return (
        <DevPageShell
            title="Tabs looks — real surfaces"
            backHref="/dev/tabs-proposals"
            description="TASK-22707 — the 6 candidate looks applied to the screens that actually carry tabs. Each block is the shipped component with fixture props, re-skinned through a look provider. Read the product blocks at 375x667 and the marketing blocks at ~1280."
        >
            <div className="flex flex-col gap-12">
                <Notification priority="info" title="These are the real components">
                    No markup is copied here. Each block mounts the shipped view and re-skins it through a React context
                    that <code>Tabs</code> and <code>SegmentedControl</code> read — so what you see is what the screen
                    becomes if that look wins, not a lookalike. Four of these screens still use{' '}
                    <code>SegmentedControl</code>; that is the component TASK-22707 deletes, and the look shows what
                    replaces it.
                </Notification>

                {/* ------------------------------------------------------ 1 limits */}
                <Section id="limits" title="1 — Limits, Manteca (product)" className="gap-4">
                    <Note>
                        <code>features/limits/views/MantecaLimitsView</code>. The period control is rendered inside the{' '}
                        <code>.map()</code> over currencies, so a LATAM user with ARS and BRL limits sees the same
                        control twice — both bound to one <code>period</code> state, so switching one switches both.
                        That repetition is the thing to judge: a loud look is loud N times.
                    </Note>
                    <LookSet surface="limits">
                        {() => (
                            <Viewport height="h-[600px]">
                                <MantecaLimitsView />
                            </Viewport>
                        )}
                    </LookSet>
                </Section>

                {/* ---------------------------------------------------- 2 explorer */}
                <Section id="explorer-header" title="2 — Explorer header (product)" className="gap-4">
                    <Note>
                        <code>features/payment-network-explorer/ExplorerHeader</code>. Graph/Table sits in a dense
                        header beside a title, a live-data badge, a search box and a Close link. The control has to be
                        findable without shouting over the header.
                    </Note>
                    <LookSet surface="explorer-header">
                        {() => (
                            <ExplorerHeader
                                view="graph"
                                searching={false}
                                searchError={null}
                                onViewChange={noop}
                                onSearch={async () => true}
                            />
                        )}
                    </LookSet>
                </Section>

                {/* ------------------------------------------------- 3 filterpanel */}
                <Section id="filter-panel" title="3 — Explorer filter panel (product)" className="gap-4">
                    <Note>
                        <code>features/payment-network-explorer/FilterPanel</code>, in the 280px aside it occupies on
                        desktop. The direction control is <code>fullWidth</code> inside a fieldset, directly under a
                        legend and above more form rows — the case where a look can read as a divider or a heading
                        instead of a control.
                    </Note>
                    <LookSet surface="filter-panel">
                        {() => (
                            <div className="w-[280px]">
                                <FilterPanel
                                    filters={EXPLORER_FILTERS}
                                    relationships={EXPLORER_RELATIONSHIPS}
                                    onChange={noop}
                                    onReset={noop}
                                />
                            </div>
                        )}
                    </LookSet>
                </Section>

                {/* ------------------------------------------------------- 4 rhino */}
                <Section id="rhino-deposit" title="4 — Crypto deposit networks (product)" className="gap-4">
                    <Note>
                        <code>components/AddMoney/views/RhinoDeposit.view</code>. EVM / Solana / Tron,{' '}
                        <code>fullWidth</code>, directly above a QR code and a copy field. Reached in the app only with
                        a live deposit address, so it is mounted here with fixture props.
                    </Note>
                    <LookSet surface="rhino-deposit">
                        {() => (
                            <Viewport height="h-[620px]">
                                <RhinoDepositView
                                    chainType={chainType}
                                    setChainType={(next) => setChainType(next as 'EVM' | 'SOL' | 'TRON')}
                                    depositAddressData={RHINO_DEPOSIT}
                                    isDepositAddressDataLoading={false}
                                    headerTitle="Add money"
                                    onSuccess={noop}
                                />
                            </Viewport>
                        )}
                    </LookSet>
                </Section>

                {/* ----------------------------------------------- 5 tokenselector */}
                <Section id="token-selector" title="5 — Token selector networks (product, panelled)" className="gap-4">
                    <Note>
                        <code>components/Global/TokenSelector</code> — the one product screen where the tabs carry a
                        real content panel and icon+text labels. The tabs live inside the drawer, so open one button at
                        a time; each button is wrapped in its own look.
                    </Note>
                    <LookSet surface="token-selector">
                        {(look) => (
                            <div className="p-4">
                                <TokenSelector viewType="withdraw" classNameButton={`token-selector-${look}`} />
                            </div>
                        )}
                    </LookSet>
                </Section>

                {/* --------------------------------------------------- 6 mdx tabs */}
                <Section id="marketing-mdx" title="6 — Marketing content tabs (marketing, panelled)" className="gap-4">
                    <Note>
                        <code>components/Marketing/mdx/Tabs</code> with the real comparison block from{' '}
                        <code>content/send-to/argentina</code>. Panelled, <code>forceMount</code> (every panel stays in
                        the HTML for crawlers) and long prose. Read this one at desktop width.
                    </Note>
                    <LookSet surface="marketing-mdx">
                        {() => (
                            <MarketingTabs labels="Peanut,Wise,Western Union">
                                <TabPanel label="Peanut">
                                    <p className="mb-3">
                                        <strong>Fee:</strong> Free — no deposit, transfer, or spending fees.
                                    </p>
                                    <p className="mb-3">
                                        <strong>Exchange rate:</strong> Cripto dólar (free market rate). Consistently
                                        2–11% better than MEP.
                                    </p>
                                    <p className="mb-3">
                                        <strong>Speed:</strong> Peanut-to-Peanut is instant. Mercado Pago spending is
                                        instant. SEPA deposits land in under 20 minutes.
                                    </p>
                                    <p>
                                        <strong>Best for:</strong> Anyone who wants the most pesos per dollar with zero
                                        fees.
                                    </p>
                                </TabPanel>
                                <TabPanel label="Wise">
                                    <p className="mb-3">
                                        <strong>Fee:</strong> 0.4-1.5% per transfer ($2-$7.50 on $500).
                                    </p>
                                    <p className="mb-3">
                                        <strong>Exchange rate:</strong> MEP-equivalent — 2–11% worse than cripto dólar.
                                    </p>
                                    <p className="mb-3">
                                        <strong>Speed:</strong> 1-2 business days for most transfers.
                                    </p>
                                    <p>
                                        <strong>Best for:</strong> Users who prefer a traditional bank-to-bank transfer
                                        flow.
                                    </p>
                                </TabPanel>
                                <TabPanel label="Western Union">
                                    <p className="mb-3">
                                        <strong>Fee:</strong> $5-$15+ flat fee per transfer.
                                    </p>
                                    <p className="mb-3">
                                        <strong>Exchange rate:</strong> 5-10% markup built into the rate.
                                    </p>
                                    <p className="mb-3">
                                        <strong>Speed:</strong> Hours to days depending on delivery method.
                                    </p>
                                    <p>
                                        <strong>Best for:</strong> Cash pickup where no bank account exists.
                                    </p>
                                </TabPanel>
                            </MarketingTabs>
                        )}
                    </LookSet>
                </Section>

                {/* ------------------------------------------------ 7 content hub */}
                <Section id="content-hub" title="7 — Content hub filters (marketing, PROPOSED)" className="gap-4">
                    <Note>
                        <strong>Not yet migrated.</strong> <code>components/Marketing/ContentLanding</code> still
                        filters with five raw <code>&lt;button&gt;</code> chips painted{' '}
                        <code>bg-action-primary/20</code> — the alpha hack this task removes. TASK-22707 is what
                        unblocks them. Below is the proposed migration: the real result list (
                        <code>ContentLinkList</code>) under a real tab row carrying the hub&rsquo;s own labels.
                    </Note>
                    <LookSet surface="content-hub">
                        {(look) => (
                            <div className="py-4">
                                {/* the hub column the chips sit in today, so the row lines up with the results */}
                                <div className={`mx-auto ${HUB_WIDTH} px-6 md:px-4`}>
                                    <ProposalTabs
                                        variant={look}
                                        aria-label="Filter content"
                                        tabs={[
                                            { value: 'all', label: CONTENT_STRINGS.filterAll },
                                            { value: 'blog', label: CONTENT_STRINGS.filterBlog },
                                            { value: 'stories', label: CONTENT_STRINGS.filterStories },
                                            { value: 'use-cases', label: CONTENT_STRINGS.filterUseCases },
                                            { value: 'compare', label: CONTENT_STRINGS.filterCompare },
                                        ]}
                                    />
                                </div>
                                <ContentLinkList items={CONTENT_ITEMS} strings={CONTENT_STRINGS} grouped={false} />
                            </div>
                        )}
                    </LookSet>
                </Section>

                <Notification priority="info" title="Scope">
                    <code>0_Bruddle/TabsLook</code> and both proposal pages are dev-only. With no look provider above
                    them — every shipped screen — <code>Tabs</code> and <code>SegmentedControl</code> render exactly as
                    they do today. All of it is deleted when the winner lands.
                </Notification>
            </div>
        </DevPageShell>
    )
}
