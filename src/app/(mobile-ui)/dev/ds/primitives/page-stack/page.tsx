'use client'

import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Button } from '@/components/0_Bruddle/Button'
import { PropsTable } from '../../_components/PropsTable'
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
                                    <Button variant="purple" shadowSize="4" className="w-full">
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
    <Button variant="purple" shadowSize="4" className="w-full">…</Button>
  </PageStack.Footer>
</PageStack>`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
