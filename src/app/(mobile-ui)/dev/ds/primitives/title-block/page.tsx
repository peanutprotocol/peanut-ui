'use client'

import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PropsTable } from '../../_components/PropsTable'
import { ProductUsage } from '../../_components/ProductUsage'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { WhenToUse } from '../../_components/WhenToUse'

export default function TitleBlockPage() {
    return (
        <DocPage>
            <DocHeader
                title="TitleBlock"
                description="Title + supporting text pair, extracted from EmptyState. Code-only recipe (no figma board)."
                status="production"
            />

            <WhenToUse
                use={[
                    'A title and its supporting line as one pair: screen hero, empty state, processing screen',
                    'Centered confirm copy in a modal or a nested drawer — align="center"',
                    'A screen hero at heading-s — pass size, and put your own <h1> in title',
                    'An action that belongs with the copy — pass it as children so it inherits the block gap',
                ]}
                dontUse={[
                    'A heading over a list or a card stack — use Section',
                    'The page title in the header — use NavHeader',
                    'A no-data card — use EmptyState, which already composes TitleBlock',
                    'A heading size outside the size set — pick a size; never restyle the title at the call site',
                ]}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'title', type: 'ReactNode', default: '(required)' },
                    { name: 'description', type: 'ReactNode', default: '(none)', description: 'body-s secondary line' },
                    { name: 'align', type: "'start' | 'center'", default: "'start'" },
                    {
                        name: 'size',
                        type: "'card' | 's' | 'm'",
                        default: "'card'",
                        description: 'heading token for the title',
                    },
                    {
                        name: 'children',
                        type: 'ReactNode',
                        default: '(none)',
                        description: 'extra content inside the block (e.g. a cta)',
                    },
                ]}
            />

            <DocSection title="Examples">
                <DocSection.Content>
                    <div className="flex flex-col gap-6">
                        <TitleBlock title="Card default" description="text-heading-card + text-body-s secondary" />
                        <TitleBlock title="Centered hero" description="align center, size s" align="center" size="s" />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'`} />
                    <CodeBlock
                        label="Hero"
                        code={`<TitleBlock title={t('title')} description={t('subtitle')} align="center" size="s" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Empty states — every 'nothing here yet' card"
                    path="src/components/Global/EmptyStates/EmptyState.tsx"
                    description="The block TitleBlock was extracted from. The optional cta goes through children, so it inherits the block's gap instead of being positioned by the caller. One wrapper, many screens: history, activity, limits."
                    code={`<Card className="items-center gap-2 px-4 py-6 text-center">
    <IconBubble icon={icon} size="s" color={iconColor} />
    <TitleBlock title={title} description={description}>
        {cta}
    </TitleBlock>
</Card>`}
                >
                    <Card className="items-center gap-2 px-4 py-6 text-center">
                        <IconBubble icon="alert" size="s" color="gray" />
                        <TitleBlock title="No transactions yet" description="Money you send and receive shows up here.">
                            <LinkButton onClick={() => {}}>Add money</LinkButton>
                        </TitleBlock>
                    </Card>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Card — physical card waitlist"
                    path="src/components/Card/PhysicalCardScreen.tsx"
                    description="A screen hero: size s, centered, and the title is an <h1> so the page keeps one real heading. The block only sets the type token — the element stays the caller's choice."
                    code={`<TitleBlock
    title={<h1>{t('onListTitle')}</h1>}
    description={
        data.position === null ? t('onListBodyPending') : t('onListBody', { position: data.position.toLocaleString() })
    }
    align="center"
    size="s"
/>`}
                >
                    <div className="flex flex-col gap-6">
                        <TitleBlock
                            title={<h1>You are on the list</h1>}
                            description="You are number 1,284. We will tell you when your card is ready to order."
                            align="center"
                            size="s"
                        />
                        <Button variant="primary" className="w-full">
                            Join the waitlist
                        </Button>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Processing screen — qr-pay and add-money"
                    path="src/components/Global/ProcessingScreen.tsx"
                    description="The mascot loader over a centered TitleBlock at the default card size. Copy stays truthful: no invented durations, no progress bar."
                    code={`<div className="my-auto flex flex-col items-center gap-6">
    <PeanutMascot … />
    <TitleBlock align="center" title={title} description={description} />
</div>`}
                >
                    <div className="flex flex-col items-center gap-6">
                        {/* the real screen puts the mascot loader here */}
                        <IconBubble icon="clock" size="s" color="gray" />
                        <TitleBlock
                            align="center"
                            title="Sending your payment"
                            description="This can take a moment. You can stay on this screen."
                        />
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
