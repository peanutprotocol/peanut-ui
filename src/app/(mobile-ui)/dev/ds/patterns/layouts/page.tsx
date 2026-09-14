'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function LayoutsPage() {
    return (
        <DocPage>
            <DocHeader
                title="Layouts"
                description="Three page layout recipes used across the app. Every screen follows one of these patterns."
                status="production"
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
                                    <Icon name="chevron-up" size={12} className="-rotate-90" />
                                    <span className="text-body-xs text-foreground-secondary">
                                        NavHeader (hideLabel)
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-1 items-center justify-center">
                                <div className="space-y-2 text-center">
                                    <div className="mx-auto size-8 rounded-round bg-action-primary/30" />
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
  <Button variant="purple" shadowSize="4" className="w-full">
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
                            <div className="space-y-1.5 mt-2">
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
  <Button variant="purple" shadowSize="4" className="w-full">
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
                    {/* Error callout */}
                    <div className="space-y-2 rounded-sm border border-border-error bg-background-badge-error/30 p-3">
                        <div className="flex items-center gap-1">
                            <Icon name="cancel" size={14} className="text-foreground-error" />
                            <span className="text-label-m text-foreground-error">Wrong</span>
                        </div>
                        <p className="text-body-xs text-foreground-secondary">
                            Without h-full the flex container collapses to content height. The CTA sits right below
                            content instead of at the bottom.
                        </p>
                    </div>

                    {/* Success callout */}
                    <div className="space-y-2 rounded-sm border border-background-icon-bubble-green bg-background-badge-success/40 p-3">
                        <div className="flex items-center gap-1">
                            <Icon name="success" size={14} className="text-background-icon-bubble-green" />
                            <span className="text-label-m text-background-icon-bubble-green">Correct</span>
                        </div>
                        <p className="text-body-xs text-foreground-secondary">
                            h-full ensures the flex column fills the available height from PageContainer. flex-1 on the
                            content area pushes the CTA to the bottom.
                        </p>
                    </div>

                    {/* Error callout 2 */}
                    <div className="space-y-2 rounded-sm border border-border-error bg-background-badge-error/30 p-3">
                        <div className="flex items-center gap-1">
                            <Icon name="cancel" size={14} className="text-foreground-error" />
                            <span className="text-label-m text-foreground-error">Wrong</span>
                        </div>
                        <p className="text-body-xs text-foreground-secondary">
                            overflow-y-auto alone does nothing unless the element has a bounded height. Use flex-1
                            inside a flex-col container, or set an explicit max-height.
                        </p>
                    </div>

                    {/* Success callout 2 */}
                    <div className="space-y-2 rounded-sm border border-background-icon-bubble-green bg-background-badge-success/40 p-3">
                        <div className="flex items-center gap-1">
                            <Icon name="success" size={14} className="text-background-icon-bubble-green" />
                            <span className="text-label-m text-background-icon-bubble-green">Correct</span>
                        </div>
                        <p className="text-body-xs text-foreground-secondary">
                            Inside a flex column with h-full, flex-1 fills remaining space and provides the bounded
                            height that overflow-y-auto needs to actually scroll.
                        </p>
                    </div>
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
        </DocPage>
    )
}
