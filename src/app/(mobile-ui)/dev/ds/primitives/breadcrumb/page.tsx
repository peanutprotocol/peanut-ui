'use client'

import { Breadcrumb } from '@/components/0_Bruddle/Breadcrumb'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function BreadcrumbPage() {
    return (
        <DocPage>
            <DocHeader
                title="Breadcrumb"
                description="Trail of parent pages above marketing and content pages. The last entry is the current page and never links."
                status="production"
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    {
                        name: 'items',
                        type: '{ name: string; href: string }[]',
                        default: '(required)',
                        description: 'Ordered trail, root first. The last entry is the current page',
                    },
                    {
                        name: 'label',
                        type: 'string',
                        default: "'Breadcrumb'",
                        description: 'Accessible name of the nav landmark. Pass a translated string on localized pages',
                    },
                    { name: 'className', type: 'string', default: '(none)' },
                ]}
            />

            <DocSection title="Examples">
                <DocSection.Content>
                    <div className="space-y-6">
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Two levels</p>
                            <Breadcrumb
                                items={[
                                    { name: 'Home', href: '/' },
                                    { name: 'Help', href: '/help' },
                                ]}
                            />
                        </div>
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">
                                Three levels — the current page truncates
                            </p>
                            <Breadcrumb
                                items={[
                                    { name: 'Home', href: '/' },
                                    { name: 'Blog', href: '/blog' },
                                    {
                                        name: 'How Peanut keeps cross-border fees honest',
                                        href: '/blog/honest-fees',
                                    },
                                ]}
                            />
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { Breadcrumb } from '@/components/0_Bruddle/Breadcrumb'`} />
                    <CodeBlock
                        label="Usage"
                        code={`<Breadcrumb
    items={[
        { name: 'Home', href: '/' },
        { name: 'Help', href: '/help' },
    ]}
/>`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
