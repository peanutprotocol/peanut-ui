'use client'

import Loading from '@/components/Global/Loading'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

export default function LoadingPage() {
    return (
        <DocPage>
            <DocHeader
                title="Loading"
                description="One Loading component: spinner variant for inline/button use, mascot variant (the old PeanutLoading) for full-page or section loading states."
                status="production"
            />

            {/* Loading (CSS Spinner) */}
            <DocSection title="Loading (CSS Spinner)">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Minimal CSS-only spinner. Uses border animation. Size controlled via className.
                    </p>

                    <div className="space-y-4">
                        <p className="text-label-m text-foreground-secondary uppercase">Sizes</p>
                        <div className="flex items-end gap-6">
                            <div className="text-center">
                                <Loading className="h-3 w-3" />
                                <p className="mt-2 text-body-xs text-foreground-secondary">h-3 w-3</p>
                            </div>
                            <div className="text-center">
                                <Loading />
                                <p className="mt-2 text-body-xs text-foreground-secondary">h-4 w-4 (default)</p>
                            </div>
                            <div className="text-center">
                                <Loading className="h-6 w-6" />
                                <p className="mt-2 text-body-xs text-foreground-secondary">h-6 w-6</p>
                            </div>
                            <div className="text-center">
                                <Loading className="h-8 w-8" />
                                <p className="mt-2 text-body-xs text-foreground-secondary">h-8 w-8</p>
                            </div>
                            <div className="text-center">
                                <Loading className="h-12 w-12" />
                                <p className="mt-2 text-body-xs text-foreground-secondary">h-12 w-12</p>
                            </div>
                        </div>
                    </div>

                    <PropsTable
                        rows={[
                            {
                                name: 'variant',
                                type: "'spinner' | 'mascot'",
                                default: "'spinner'",
                                description: 'spinner = inline; mascot = screen-level (old PeanutLoading)',
                            },
                            {
                                name: 'className',
                                type: 'string',
                                default: "'h-4 w-4'",
                                description: 'Controls size via Tailwind width/height',
                            },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import Loading from '@/components/Global/Loading'`} />

                    <CodeBlock
                        label="Usage"
                        code={`<Loading />                     {/* default 16px */}
<Loading className="h-8 w-8" /> {/* 32px */}`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* mascot variant */}
            <DocSection title='Loading variant="mascot" (Branded)'>
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Spinning Peanut logo with optional message. Can cover the full screen as an overlay.
                    </p>

                    {/* Inline demo */}
                    <div className="space-y-4">
                        <p className="text-label-m text-foreground-secondary uppercase">Inline</p>
                        <div className="rounded-sm border border-border-default p-4">
                            <Loading variant="mascot" message="Processing your transaction..." />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-label-m text-foreground-secondary uppercase">Without message</p>
                        <div className="rounded-sm border border-border-default p-4">
                            <Loading variant="mascot" />
                        </div>
                    </div>

                    <PropsTable
                        rows={[
                            {
                                name: 'coverFullScreen',
                                type: 'boolean',
                                default: 'false',
                                description: 'Fixed overlay covering entire viewport',
                            },
                            {
                                name: 'message',
                                type: 'string',
                                default: '(none)',
                                description: 'Text shown below the spinner',
                            },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import Loading from '@/components/Global/Loading'`} />

                    <CodeBlock
                        label="Usage"
                        code={`{/* Inline */}
<Loading variant="mascot" message="Loading your wallet..." />

{/* Full screen overlay */}
<Loading variant="mascot" coverFullScreen message="Please wait..." />`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Design Notes */}
            <DocSection title="Design Rules">
                <DesignNote type="info">
                    Use the spinner variant inside buttons, inline indicators, and small containers. Use
                    variant="mascot" for page-level or section-level loading states where brand presence matters.
                </DesignNote>
                <DesignNote type="warning">
                    variant="mascot" with coverFullScreen renders a fixed z-50 overlay. Make sure to conditionally
                    render it only when loading is active to avoid blocking the UI.
                </DesignNote>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Home — balance while it refetches"
                    path="src/features/home/views/BalanceSection.tsx"
                    description="Default spinner standing in for the amount. The wrapper keeps the heading line height, so the page does not jump when the number arrives."
                    code={`{/* 48px = the heading-xl line height, so the page does not jump when the number arrives. */}
<div className="flex min-h-12 items-center justify-center gap-2">
  {isFetching || balance === undefined ? (
    <Loading />
  ) : (
    <span className="flex items-center gap-2">
      <span className="text-heading-s text-foreground-primary">$</span>
      <span className="text-heading-xl text-foreground-primary">{formatted}</span>
    </span>
  )}
</div>`}
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex min-h-12 items-center justify-center gap-2">
                            <Loading />
                        </div>
                        <div className="flex min-h-12 items-center justify-center gap-2">
                            <span className="text-heading-s text-foreground-primary">$</span>
                            <span className="text-heading-xl text-foreground-primary">42.50</span>
                        </div>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="App shell — auth not ready yet"
                    path="src/app/(mobile-ui)/layout.tsx"
                    description="The mascot variant carries the whole screen while the session resolves. No message: the wait is short and the brand mark says enough."
                    code={`if (!isReady) {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center">
      <Loading variant="mascot" />
    </div>
  )
}`}
                >
                    <div className="flex h-48 w-full flex-col items-center justify-center">
                        <Loading variant="mascot" />
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
