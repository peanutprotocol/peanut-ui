'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import Card from '@/components/Global/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { WhenToUse } from '../../_components/WhenToUse'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

export default function LayoutsPage() {
    return (
        <DocPage>
            <DocHeader
                title="Layouts"
                description="Three page layout recipes used across the app. Every screen follows one of these patterns."
                status="production"
            />

            <WhenToUse
                use={[
                    'Recipe 1 — content and its CTA centered in one block: amount steps, confirmations, success screens.',
                    'Recipe 2 — content from the top with the CTA pinned at the bottom: forms, settings, claim screens.',
                    'Recipe 3 — header plus a list that fills the rest: history, token lists, contacts.',
                    'PageStack, PageStack.Center and PageStack.Footer — the coded form of these recipes. Prefer them over raw markup.',
                    'NavHeader as the first child of the page shell.',
                ]}
                dontUse={[
                    'Absolute or fixed positioning for a bottom CTA — the flex recipe handles keyboard, safe area, and overflow.',
                    'space-y-* on the page shell — it fights my-auto centering. Use gap-*.',
                    'A per-page desktop layout, a bottom nav, or safe-area padding of your own — PageContainer and the (mobile-ui) layout own those.',
                ]}
            />

            {/* Recipe 1: Centered Content + CTA */}
            <DocSection title="1. Centered Content + CTA (Most Common)">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Content vertically centered in viewport, CTA button pinned to the bottom. Used for: claim pages,
                        success states, amount input, confirmations.
                    </p>

                    {/* Wireframe */}
                    <div className="rounded-sm border border-border-default">
                        <div className="flex h-80 flex-col p-3">
                            <div className="rounded-sm bg-background-disabled px-3 py-1">
                                <div className="flex items-center gap-1">
                                    <Icon name="chevron-up" size={16} className="-rotate-90" />
                                    <span className="text-body-xs text-foreground-secondary">
                                        NavHeader (hideLabel)
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-1 items-center justify-center">
                                <div className="space-y-2 text-center">
                                    <div className="mx-auto size-8 rounded-full bg-action-primary/30" />
                                    <div className="text-label-m">Main Content</div>
                                    <div className="text-body-xs text-foreground-secondary">flex-1 + items-center</div>
                                </div>
                            </div>
                            <div className="rounded-sm bg-action-primary/20 px-3 py-2 text-center">
                                <span className="text-label-m">CTA Button</span>
                            </div>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Pattern 1: Centered Content + CTA"
                        code={`<div className="flex h-full flex-col">
  <NavHeader hideLabel onPrev={handleBack} />

  {/* Centered content */}
  <div className="flex flex-1 items-center justify-center">
    <div className="text-center">
      {/* Icon, title, description */}
    </div>
  </div>

  {/* Bottom CTA */}
  <Button variant="primary" shadowSize="4" className="w-full">
    Continue
  </Button>
</div>`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* Recipe 2: Pinned Footer CTA */}
            <DocSection title="2. Pinned Footer CTA">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Content flows naturally from top, CTA stays at the very bottom regardless of content height.
                        Used for: forms, settings, token selection.
                    </p>

                    {/* Wireframe */}
                    <div className="rounded-sm border border-border-default">
                        <div className="flex h-80 flex-col p-3">
                            <div className="rounded-sm bg-background-disabled px-3 py-1">
                                <span className="text-body-xs text-foreground-secondary">NavHeader</span>
                            </div>
                            <div className="space-y-2 mt-2">
                                <div className="rounded-sm bg-background-badge-accent/20 px-3 py-2">
                                    <span className="text-body-xs">Form Field 1</span>
                                </div>
                                <div className="rounded-sm bg-background-badge-accent/20 px-3 py-2">
                                    <span className="text-body-xs">Form Field 2</span>
                                </div>
                                <div className="rounded-sm bg-background-badge-accent/20 px-3 py-2">
                                    <span className="text-body-xs">Form Field 3</span>
                                </div>
                            </div>
                            <div className="flex-1" />
                            <div className="rounded-sm bg-action-primary/20 px-3 py-2 text-center">
                                <span className="text-label-m">Submit Button</span>
                            </div>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Pattern 2: Pinned Footer CTA"
                        code={`<div className="flex h-full flex-col">
  <NavHeader title="Settings" />

  {/* Top-aligned content */}
  <div className="space-y-3 py-4">
    <BaseInput label="Name" ... />
    <BaseInput label="Email" ... />
  </div>

  {/* Spacer pushes CTA to bottom */}
  <div className="flex-1" />

  {/* Pinned CTA */}
  <Button variant="primary" shadowSize="4" className="w-full">
    Save Changes
  </Button>
</div>`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* Recipe 3: Scrollable List */}
            <DocSection title="3. Scrollable List">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Header + scrollable list area + optional footer. The list scrolls independently while header and
                        footer remain fixed. Used for: transaction history, token lists, contact lists.
                    </p>

                    {/* Wireframe */}
                    <div className="rounded-sm border border-border-default">
                        <div className="flex h-80 flex-col p-3">
                            <div className="rounded-sm bg-background-disabled px-3 py-1">
                                <span className="text-body-xs text-foreground-secondary">
                                    NavHeader + Search/Filter
                                </span>
                            </div>
                            <div className="space-y-1 mt-2 flex-1 overflow-hidden">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div
                                        key={i}
                                        className="rounded-sm border border-border-disabled bg-background-default px-3 py-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-body-xs">List Item {i}</span>
                                            <span className="text-body-xs text-foreground-secondary">detail</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="text-center text-body-xs text-foreground-secondary">
                                    overflow-y-auto
                                </div>
                            </div>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Pattern 3: Scrollable List"
                        code={`<div className="flex h-full flex-col">
  <NavHeader title="History" />

  {/* Fixed search bar */}
  <div className="py-2">
    <BaseInput placeholder="Search..." />
  </div>

  {/* Scrollable list */}
  <div className="flex-1 overflow-y-auto">
    {items.map(item => (
      <Card key={item.id} position={getPosition(index, items.length)}>
        {/* Item content */}
      </Card>
    ))}
  </div>
</div>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Common Mistakes */}
            <DocSection title="Common Mistakes">
                <DocSection.Content>
                    <Callout priority="error" title="Wrong">
                        <p>
                            Without h-full the flex container collapses to content height. The CTA sits right below
                            content instead of at the bottom.
                        </p>
                    </Callout>

                    <Callout priority="success" title="Correct">
                        <p>
                            h-full ensures the flex column fills the available height from PageContainer. flex-1 on the
                            content area pushes the CTA to the bottom.
                        </p>
                    </Callout>

                    <Callout priority="error" title="Wrong">
                        <p>
                            overflow-y-auto alone does nothing unless the element has a bounded height. Use flex-1
                            inside a flex-col container, or set an explicit max-height.
                        </p>
                    </Callout>

                    <Callout priority="success" title="Correct">
                        <p>
                            Inside a flex column with h-full, flex-1 fills remaining space and provides the bounded
                            height that overflow-y-auto needs to actually scroll.
                        </p>
                    </Callout>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Wrong: Missing h-full"
                        code={`{/* Missing h-full on container - CTA won't pin to bottom */}
<div className="flex flex-col">
  <div className="flex-1">Content</div>
  <Button>Submit</Button>
</div>`}
                    />

                    <CodeBlock
                        label="Correct: With h-full"
                        code={`{/* h-full makes container fill PageContainer */}
<div className="flex h-full flex-col">
  <div className="flex-1">Content</div>
  <Button>Submit</Button>
</div>`}
                    />

                    <CodeBlock
                        label="Wrong: Scrollable without bounded height"
                        code={`{/* Scrollable area without bounded height */}
<div className="overflow-y-auto">
  {items.map(...)}
</div>`}
                    />

                    <CodeBlock
                        label="Correct: flex-1 provides bounded height"
                        code={`{/* flex-1 gives the scroll area a bounded height */}
<div className="flex h-full flex-col">
  <div className="flex-1 overflow-y-auto">
    {items.map(...)}
  </div>
</div>`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* Design Notes */}
            <DocSection title="Design Rules">
                <DesignNote type="info">
                    Every page is wrapped in PageContainer which provides padding and max-width. Your layout div needs
                    h-full to fill it.
                </DesignNote>
                <DesignNote type="info">
                    The key pattern is always: flex flex-col h-full. Then use flex-1 on the expanding section and let
                    the CTA sit naturally at the bottom.
                </DesignNote>
                <DesignNote type="warning">
                    Never use absolute/fixed positioning for bottom CTAs. The flex approach handles keyboard open, safe
                    areas, and content overflow correctly.
                </DesignNote>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Withdraw — amount step (recipe 1)"
                    path="src/features/withdraw/views/WithdrawAmountView.tsx"
                    description="PageStack is the coded form of these recipes. Center holds the amount and its CTA in the middle of the screen; the header stays at the top."
                    code={`<PageStack>
  <NavHeader title={pageTitle} onPrev={onBack} />
  <PageStack.Center className="gap-4">
    <div className="text-heading-xs text-foreground-primary">{heading}</div>
    <AmountInput ... />
    {limitsCardProps && <LimitsWarningCard {...limitsCardProps} />}
    <Button variant="primary" shadowSize="4" onClick={onContinue} disabled={continueDisabled}>
      {tCommon('continue')}
    </Button>
  </PageStack.Center>
</PageStack>`}
                >
                    <div className="h-72">
                        <PageStack className="h-full">
                            <div className="flex items-center gap-1 rounded-sm bg-background-disabled px-3 py-1">
                                <Icon name="chevron-up" size={16} className="-rotate-90" />
                                <span className="text-body-xs text-foreground-secondary">Withdraw</span>
                            </div>
                            <PageStack.Center className="gap-4">
                                <div className="text-center text-heading-xs text-foreground-primary">
                                    Amount to withdraw
                                </div>
                                <div className="text-center text-heading-big-input">$0.00</div>
                                <Button variant="primary" shadowSize="4" className="w-full">
                                    Continue
                                </Button>
                            </PageStack.Center>
                        </PageStack>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Deposit accounts — claim an account (recipe 2)"
                    path="src/features/deposit-accounts/components/ClaimAccountScreen.tsx"
                    description="Content flows from the top and PageStack.Footer pins the terms note and the CTA to the bottom, whatever the content height."
                    code={`<PageStack>
  <NavHeader title={t('title')} onPrev={onBack} />
  <div className="flex flex-col gap-6">
    <TitleBlock size="s" title={...} description={...} />
    {/* rails, rules */}
  </div>
  <PageStack.Footer>
    <Callout priority="info">{t('claim.conditions')}</Callout>
    <Button variant="primary" shadowSize="4" onClick={onClaim}>{t('claim.cta')}</Button>
  </PageStack.Footer>
</PageStack>`}
                >
                    <div className="h-72">
                        <PageStack className="h-full">
                            <div className="flex items-center gap-1 rounded-sm bg-background-disabled px-3 py-1">
                                <Icon name="chevron-up" size={16} className="-rotate-90" />
                                <span className="text-body-xs text-foreground-secondary">Open an account</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-label-l">Your own account number in USD</span>
                                <span className="text-body-s text-foreground-secondary">
                                    Get paid in USD and hold the money in Peanut.
                                </span>
                            </div>
                            <PageStack.Footer>
                                <Callout priority="info">Free to open. No minimum balance.</Callout>
                                <Button variant="primary" shadowSize="4" className="w-full">
                                    Open account
                                </Button>
                            </PageStack.Footer>
                        </PageStack>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="History — activity list (recipe 3)"
                    path="src/app/(mobile-ui)/history/page.tsx"
                    description="Header plus a list that fills the rest. The rows are Global Cards and the corners are set per date group, not per page."
                    code={`<PageStack>
  <NavHeader title={t('title')} />
  <div className="h-full w-full">
    {combinedAndSortedEntries.map((item, index) => {
      let position: CardPosition = 'middle'
      if (isFirstInGroup && isLastInGroup) position = 'solo'
      else if (isFirstInGroup) position = 'top'
      else if (isLastInGroup) position = 'bottom'
      return <TransactionCard key={item.uuid} position={position} ... />
    })}
  </div>
</PageStack>`}
                >
                    <div className="h-72">
                        <PageStack className="h-full">
                            <div className="rounded-sm bg-background-disabled px-3 py-1">
                                <span className="text-body-xs text-foreground-secondary">History</span>
                            </div>
                            <div className="h-full w-full overflow-hidden">
                                <div className="mb-2 text-label-m text-foreground-primary">Today</div>
                                {(['top', 'bottom'] as const).map((pos, i) => (
                                    <Card key={pos} position={pos} className="p-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-body-s">Sent to hugo</span>
                                            <span className="text-body-s">-${(i + 1) * 12}.00</span>
                                        </div>
                                    </Card>
                                ))}
                                <div className="mt-2 mb-2 text-label-m text-foreground-primary">Yesterday</div>
                                <Card position="solo" className="p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-body-s">Added money</span>
                                        <span className="text-body-s">+$100.00</span>
                                    </div>
                                </Card>
                            </div>
                        </PageStack>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
