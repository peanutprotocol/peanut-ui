'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import Card from '@/components/Global/Card'
import { PropsTable } from '../../_components/PropsTable'
import { ProductUsage } from '../../_components/ProductUsage'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function PageContainerPage() {
    return (
        <DocPage>
            <DocHeader
                title="PageContainer"
                description="Responsive page wrapper with max-width centering. On desktop, applies left padding for sidebar offset."
                status="production"
            />

            <SectionDivider />

            <PropsTable rows={[{ name: 'alignItems', type: "'start' | 'center'", default: "'start'" }]} />

            <DocSection title="Usage">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Wraps mobile screens with responsive width constraints. Children inherit full width via the{' '}
                        <code className="font-mono">*:w-full</code> selector. On desktop, content uses the sidebar
                        offset and is capped at <code className="font-mono">md:*:max-w-xl</code>.
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import PageContainer from '@/components/0_Bruddle/PageContainer'`}
                    />
                    <CodeBlock
                        label="Usage"
                        code={`<PageContainer>
  <div className="flex min-h-inherit flex-col gap-8">
    <NavHeader title="Title" />
    <div className="my-auto flex flex-col gap-6">
      {/* content */}
    </div>
  </div>
</PageContainer>`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <p className="text-body-s text-foreground-secondary">
                    Each recreation is boxed so the miniature page cannot stretch this doc. The real container is the
                    outermost element on the screen, so the max-width cap only shows up at desktop width.
                </p>

                <ProductUsage.Example
                    title="Home — the app's landing screen"
                    path="src/features/home/HomePage.tsx"
                    description="The bare form, and the most-rendered one: no props, one flex column inside it. Every logged-in session starts here."
                    code={`<PageContainer>
    <div className="flex h-full w-full flex-col gap-6">
        <HomeTopNav showRewards={isActivated} />
        <BalanceSection … />
        <HomeHistory />
    </div>
</PageContainer>`}
                >
                    <div className="rounded-sm border border-border-default p-2">
                        <PageContainer>
                            <div className="flex h-full w-full flex-col gap-6">
                                <div className="text-body-s text-foreground-secondary">HomeTopNav</div>
                                <div className="text-heading-m text-foreground-primary">$248.10</div>
                                <div className="text-body-s text-foreground-secondary">Activity</div>
                            </div>
                        </PageContainer>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Withdraw — the route layout"
                    path="src/app/(mobile-ui)/withdraw/layout.tsx"
                    description="A whole flow wrapped once: the layout applies the column to every step of withdraw, so no individual view has to remember it."
                    code={`export default function WithdrawLayout({ children }: { children: React.ReactNode }) {
    return (
        <WithdrawFlowProvider>
            <PageContainer>{children}</PageContainer>
        </WithdrawFlowProvider>
    )
}`}
                >
                    <div className="rounded-sm border border-border-default p-2">
                        <PageContainer>
                            <div className="text-body-s text-foreground-secondary">
                                {'{children}'} — any step of the withdraw flow
                            </div>
                        </PageContainer>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Public receipt — the shared/printable page"
                    path="src/app/receipt/[entryId]/PublicReceiptPage.tsx"
                    description="The className escape hatch: the receipt adds its own full-height, centered, padded frame on top of the container's column."
                    code={`<PageContainer className="receipt-page flex min-h-dvh flex-col items-center p-4">
    <ReceiptHeader … />
    <ReceiptDetailsCard … />
</PageContainer>`}
                >
                    <div className="rounded-sm border border-border-default p-2">
                        <PageContainer className="flex flex-col items-center p-4">
                            <Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
                                <DataRow label="Amount" value="$25.00" />
                                <DataRow label="Status" value="Completed" />
                            </Card>
                        </PageContainer>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
