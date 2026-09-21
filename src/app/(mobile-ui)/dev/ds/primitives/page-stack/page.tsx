'use client'

import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PropsTable } from '../../_components/PropsTable'
import { ProductUsage } from '../../_components/ProductUsage'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function PageStackPage() {
    return (
        <DocPage>
            <DocHeader
                title="PageStack"
                description="The page shell: NavHeader + vertical stack, with Center and Footer regions. Code-only recipe (no figma board) — codifies /dev/ds/patterns/layouts."
                status="production"
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'gap', type: "'6' | '8'", default: "'8'", description: 'Gap between page regions' },
                    {
                        name: 'PageStack.Center',
                        type: 'region',
                        default: '(none)',
                        description: 'my-auto centered content block',
                    },
                    {
                        name: 'PageStack.Footer',
                        type: 'region',
                        default: '(none)',
                        description: 'mt-auto pinned bottom CTAs',
                    },
                ]}
            />

            <DocSection title="Examples">
                <DocSection.Content>
                    <div className="h-80 rounded-sm border border-border-default">
                        <div className="min-h-full p-2">
                            <PageStack>
                                <div className="text-body-s text-foreground-secondary">NavHeader goes here</div>
                                <PageStack.Center>
                                    <div className="text-center text-body-m">centered content</div>
                                </PageStack.Center>
                                <PageStack.Footer>
                                    <Button variant="primary" shadowSize="4" className="w-full">
                                        Continue
                                    </Button>
                                </PageStack.Footer>
                            </PageStack>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { PageStack } from '@/components/0_Bruddle/PageStack'`} />
                    <CodeBlock
                        label="Centered content + pinned CTA"
                        code={`<PageStack>
  <NavHeader title={t('title')} onPrev={goBack} />
  <PageStack.Center>…</PageStack.Center>
  <PageStack.Footer>
    <Button variant="primary" shadowSize="4" className="w-full">…</Button>
  </PageStack.Footer>
</PageStack>`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <p className="text-body-s text-foreground-secondary">
                    Each recreation is boxed at a fixed height so the miniature page shell cannot stretch this doc.
                    NavHeader is a placeholder row — the real screens render Global/NavHeader there.
                </p>

                <ProductUsage.Example
                    title="History — scrolling list, no regions"
                    path="src/app/(mobile-ui)/history/page.tsx"
                    description="The plainest form: header, then one full-height child. No Center, no Footer — the list owns the rest of the page and scrolls."
                    code={`<PageStack>
    <NavHeader title={t('title')} />
    <div className="h-full w-full">
        {combinedAndSortedEntries.map((item, index) => …)}
    </div>
</PageStack>`}
                >
                    <div className="h-72 overflow-hidden rounded-sm border border-border-default">
                        <div className="min-h-full p-2">
                            <PageStack>
                                <div className="text-body-s text-foreground-secondary">NavHeader — Activity</div>
                                <div className="h-full w-full">
                                    <div className="mb-2 text-label-m text-foreground-primary">Today</div>
                                    <ListGroup>
                                        <ListItem title="Alice" body="$12.00" />
                                        <ListItem title="Bob" body="$4.50" />
                                    </ListGroup>
                                </div>
                            </PageStack>
                        </div>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Withdraw — enter an amount"
                    path="src/features/withdraw/views/WithdrawAmountView.tsx"
                    description="Center with a tightened gap: the amount keypad sits in the optical middle of the screen whatever the device height."
                    code={`<PageStack>
    <NavHeader title={pageTitle} onPrev={onBack} />
    <PageStack.Center className="gap-4">
        <div className="text-heading-xs text-foreground-primary">{heading}</div>
        <AmountInput … />
        <LimitsWarningCard … />
    </PageStack.Center>
</PageStack>`}
                >
                    <div className="h-72 overflow-hidden rounded-sm border border-border-default">
                        <div className="min-h-full p-2">
                            <PageStack>
                                <div className="text-body-s text-foreground-secondary">NavHeader — Withdraw</div>
                                <PageStack.Center className="gap-4">
                                    <div className="text-heading-xs text-foreground-primary">How much?</div>
                                    <div className="text-center text-heading-m text-foreground-primary">$120.00</div>
                                    <Button variant="primary" className="w-full">
                                        Continue
                                    </Button>
                                </PageStack.Center>
                            </PageStack>
                        </div>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="KYC — additional verification"
                    path="src/components/Kyc/AdditionalVerificationView.tsx"
                    description="Center plus Footer: the card is vertically centered while the privacy line stays pinned to the bottom, no matter how tall the card gets."
                    code={`<PageStack>
    <NavHeader title={…} onPrev={…} />
    <PageStack.Center>
        <Card>…<Button variant="primary" shadowSize="4" onClick={start}>{tPrep('startCta')}</Button></Card>
    </PageStack.Center>
    <PageStack.Footer>
        <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
    </PageStack.Footer>
</PageStack>`}
                >
                    <div className="h-72 overflow-hidden rounded-sm border border-border-default">
                        <div className="min-h-full p-2">
                            <PageStack>
                                <div className="text-body-s text-foreground-secondary">NavHeader — Verify</div>
                                <PageStack.Center>
                                    <Card className="gap-3 p-4">
                                        <div className="text-body-s text-foreground-secondary">
                                            We need one more document to finish.
                                        </div>
                                        <Button variant="primary" shadowSize="4">
                                            Start
                                        </Button>
                                    </Card>
                                </PageStack.Center>
                                <PageStack.Footer>
                                    <div className="w-full text-center text-body-xs text-foreground-secondary">
                                        Peanut does not store any personal information
                                    </div>
                                </PageStack.Footer>
                            </PageStack>
                        </div>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
