'use client'

import { Breadcrumb } from '@/components/0_Bruddle/Breadcrumb'
import { PROSE_WIDTH } from '@/components/Marketing/constants'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'

export default function BreadcrumbPage() {
    return (
        <DocPage>
            <DocHeader
                title="Breadcrumb"
                description="Trail of parent pages above marketing and content pages. The last entry is the current page and never links."
                status="production"
            />

            <WhenToUse
                use={[
                    'The parent trail on a marketing or content page — blog posts, country pages, legal pages',
                    'Pass the trail root first; the last entry is the current page and never links',
                    'Feed the same array to the BreadcrumbList JSON-LD, as the blog post page does',
                    'Pass a translated label on a localized page so the nav landmark reads in that language',
                ]}
                dontUse={[
                    'Back navigation inside the app — use NavHeader',
                    'Steps inside a flow — move with NavHeader onPrev and the nuqs step',
                    'Switching between sibling views — use Tabs',
                ]}
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

            <ProductUsage>
                <ProductUsage.Example
                    title="Blog — post footer trail"
                    path="src/app/[locale]/(marketing)/blog/[slug]/page.tsx"
                    description="Three levels, at the foot of the post. The parent crumb is the content hub filtered to blog, and the same array feeds the BreadcrumbList JSON-LD."
                    code={`const breadcrumbs = [
    { name: i18n.home, href: \`/\${locale}\` },
    { name: i18n.filterBlog, href: hubHref },
    { name: post.frontmatter.title, href: \`/\${locale}/blog/\${slug}\` },
]

<Breadcrumb items={breadcrumbs} className="pt-8" />`}
                >
                    <Breadcrumb
                        className="pt-8"
                        items={[
                            { name: 'Home', href: '/en' },
                            { name: 'Blog', href: '/en/content?type=blog' },
                            { name: 'How Peanut keeps cross-border fees honest', href: '/en/blog/honest-fees' },
                        ]}
                    />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Marketing — every ContentPage route"
                    path="src/components/Marketing/ContentPage.tsx"
                    description="One shared trail for the generated country, pay-with, deposit and legal pages. The className pins it to the prose column instead of the full page width."
                    code={`<Breadcrumb items={breadcrumbs} className={\`mx-auto \${PROSE_WIDTH} px-6 pt-4 pb-8 md:px-4\`} />`}
                >
                    <Breadcrumb
                        className={`mx-auto ${PROSE_WIDTH} px-6 pt-4 pb-8 md:px-4`}
                        items={[
                            { name: 'Home', href: '/en' },
                            { name: 'Argentina', href: '/en/receive-money-from/argentina' },
                        ]}
                    />
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
