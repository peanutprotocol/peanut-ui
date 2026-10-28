'use client'

import Divider from '@/components/0_Bruddle/Divider'
import { Button } from '@/components/0_Bruddle/Button'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { PropsTable } from '../../_components/PropsTable'
import { ProductUsage } from '../../_components/ProductUsage'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { WhenToUse } from '../../_components/WhenToUse'

export default function DividerPage() {
    return (
        <DocPage>
            <DocHeader
                title="Divider"
                description="Horizontal divider with optional text label, or a vertical dashed rule between two columns."
                status="production"
            />

            <WhenToUse
                use={[
                    'Separate two alternatives with an "or" label — sign up or log in',
                    'Separate two blocks of different kinds — a card above a list',
                    'Break long prose into parts: markdown --- renders as a Divider',
                    'Quiet the rule down with dividerClassname and textClassname when it must not compete',
                    'Separate two columns that sit side by side: orientation="vertical" draws the dashed rule, with no box around either column',
                ]}
                dontUse={[
                    'Between list rows — ListItem position draws its own divider',
                    'Between rows of a receipt card — the card owns the dashed dividers',
                    'Between page sections — use the XL/24 section gap',
                    'A vertical rule between boxed columns or inside a card: the rule replaces the boxes',
                ]}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    {
                        name: 'orientation',
                        type: "'horizontal' | 'vertical'",
                        default: "'horizontal'",
                        description:
                            'vertical: a dashed rule as tall as the taller column. Place it between the columns; it takes no text',
                    },
                    { name: 'text', type: 'string', default: '(none)', description: 'Center text label' },
                    { name: 'dividerClassname', type: 'string', default: '(none)' },
                    { name: 'textClassname', type: 'string', default: '(none)' },
                ]}
            />

            <DocSection title="Examples">
                <DocSection.Content>
                    <div className="space-y-6">
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Default</p>
                            <Divider />
                        </div>
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">With text</p>
                            <Divider text="or" />
                        </div>
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Vertical, between two columns</p>
                            <div className="flex gap-4">
                                <p className="min-w-0 flex-1 text-body-s">A short column</p>
                                <Divider orientation="vertical" />
                                <p className="min-w-0 flex-1 text-body-s">
                                    A longer column. The rule runs the height of the taller side, so the columns need no
                                    box.
                                </p>
                            </div>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import Divider from '@/components/0_Bruddle/Divider'`} />
                    <CodeBlock label="Default" code={`<Divider />`} />
                    <CodeBlock label="With Text" code={`<Divider text="or" />`} />
                    <CodeBlock
                        label="Vertical"
                        code={`<div className="flex gap-4">
    <Column className="min-w-0 flex-1" />
    <Divider orientation="vertical" />
    <Column className="min-w-0 flex-1" />
</div>`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Setup — landing, sign up or log in"
                    path="src/components/Setup/Views/Landing.tsx"
                    description="The default shape: an 'or' label between two CTAs. Highest-traffic divider in the app — every logged-out visitor sees it."
                    code={`<Button shadowSize="4" onClick={onSignupClick}>{t('landing.signUp')}</Button>
<Divider text={tCommon('or')} />
<Button loading={isLoggingIn} shadowSize="4" variant="secondary" onClick={onLoginClick}>
    {t('logIn')}
</Button>`}
                >
                    <div className="flex flex-col">
                        <Button shadowSize="4">Sign up</Button>
                        <Divider text="or" />
                        <Button shadowSize="4" variant="secondary">
                            Log in
                        </Button>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Marketing prose — the mdx horizontal rule"
                    path="src/components/Marketing/mdx/components.tsx"
                    description="Blog and help articles map markdown's --- to Divider, not <hr>: the rule's weight and color belong to the component. No label here."
                    code={`hr: () => (
    <div className={\`mx-auto my-12 \${PROSE_WIDTH}\`}>
        <Divider />
    </div>
),`}
                >
                    <div className="text-body-s text-foreground-secondary">
                        <p>…end of the previous section.</p>
                        <div className="my-6">
                            <Divider />
                        </div>
                        <p>Start of the next section.</p>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Send — payment method router"
                    path="src/components/Send/views/SendRouter.view.tsx"
                    description="Same 'or' divider, restyled down: a subtle rule and a label-m secondary label, so it separates a card from a list without competing with either."
                    code={`<Divider
    text={tCommon('or')}
    textClassname="text-label-m text-foreground-secondary"
    dividerClassname="bg-border-subtle"
/>`}
                >
                    <Divider
                        text="or"
                        textClassname="text-label-m text-foreground-secondary"
                        dividerClassname="bg-border-subtle"
                    />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Setup — residence and citizenship compared"
                    path="src/components/Setup/components/ResidenceCompare.tsx"
                    description="The vertical rule. Two countries side by side, each a flag, a name and what it unlocks; the dashed rule is the only line between them, and neither column has a box. The columns share subgrid rows, so both lists start on one line when a country name wraps."
                    code={`<Divider orientation="vertical" className="col-start-2 row-span-3 row-start-1" />
{[residence, citizenship].map((iso2) => (
    <section key={iso2} className="row-span-3 grid grid-rows-subgrid">
        <h2 className="mb-3 flex flex-col items-start gap-2 text-heading-card">…</h2>
        <BulletList size="xs" items={items} />
    </section>
))}`}
                >
                    <div className="flex gap-4">
                        <section className="flex min-w-0 flex-1 flex-col gap-3">
                            <h4 className="text-heading-card">Portugal</h4>
                            <BulletList size="xs" items={['Euro bank transfers', 'Peanut card', 'Peanut to Peanut']} />
                        </section>
                        <Divider orientation="vertical" />
                        <section className="flex min-w-0 flex-1 flex-col gap-3">
                            <h4 className="text-heading-card">Brazil</h4>
                            <BulletList size="xs" items={['PIX payments & transfers', 'Peanut to Peanut']} />
                        </section>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
