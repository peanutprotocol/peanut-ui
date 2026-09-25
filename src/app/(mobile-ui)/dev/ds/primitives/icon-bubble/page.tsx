'use client'

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS, type Concept } from '@/components/0_Bruddle/conceptIcons'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'

export default function IconBubblePage() {
    return (
        <DocPage>
            <DocHeader
                title="IconBubble"
                description="Round colored icon container from the figma icon-bubble board (17802:61528)."
                status="production"
            />

            <WhenToUse
                use={[
                    'The leading element of a ListItem (size s)',
                    'The head icon above a modal, drawer or card title (size m)',
                    'The red bubble in a destructive confirm — there is no red Button variant',
                    'Pick the color from the meaning: green success, red error, yellow warning, blue info, gray inactive',
                    'A product concept (bank, crypto, card, link…) — spread its pair from CONCEPT_ICONS',
                ]}
                dontUse={[
                    'A person — use Avatar (AvatarWithBadge); never mix an IconBubble color into it',
                    'A plain hint next to text — use Icon at size 16',
                    'A composite leading element (a mini-bubble over a logo) — the board allows one element, so flag it',
                ]}
            />

            <DocSection title="Sizes" description="xs=24, s=32, m=48, l=72px.">
                <DocSection.Content>
                    <div className="flex items-end gap-4">
                        <IconBubble icon="check" size="xs" />
                        <IconBubble icon="check" size="s" />
                        <IconBubble icon="check" size="m" />
                        <IconBubble icon="check" size="l" />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Sizes" code={`<IconBubble icon="check" size="m" />`} />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Colors" description="Color is semantic, not decorative.">
                <DocSection.Content>
                    <div className="flex items-center gap-4">
                        <IconBubble icon="check" color="green" />
                        <IconBubble icon="ban" color="red" />
                        <IconBubble icon="alert" color="yellow" />
                        <IconBubble icon="clock" color="gray" />
                        <IconBubble icon="info" color="blue" />
                    </div>
                    <DesignNote type="info">
                        Yellow is for warnings only (a caution the user should read before acting). Red is an error,
                        green a success, blue plain information or a neutral method/action icon. Gray is inactive.
                        ActionModal exposes the same mapping as its <code>tone</code> prop.
                    </DesignNote>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Colors" code={`<IconBubble icon="ban" color="red" />`} />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection
                title="Concepts"
                description="One icon and one color per product concept. Rows, drawers, pickers and activity read the pair from CONCEPT_ICONS; change a concept there, never at a call site."
            >
                <DocSection.Content>
                    <div className="grid grid-cols-3 gap-4">
                        {(Object.keys(CONCEPT_ICONS) as Concept[]).map((concept) => (
                            <div key={concept} className="flex flex-col items-center gap-2 text-center">
                                <IconBubble {...CONCEPT_ICONS[concept]} size="s" />
                                <code className="text-body-xs text-foreground-secondary">{concept}</code>
                            </div>
                        ))}
                    </div>
                    <DesignNote type="info">
                        Flags, chain logos and payment-brand marks (Pix, Mercado Pago) are not concepts: they keep their
                        own image in the same slot. Status bubbles (a link&apos;s state, a KYC result) come from the
                        state, not from this map.
                    </DesignNote>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Concept bubble"
                        code={`import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'

<ListItem leading={<IconBubble {...CONCEPT_ICONS.bank} size="s" />} title="Bank transfer" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'icon', type: 'IconName | ReactNode', default: '(required)' },
                    { name: 'size', type: "'xs' | 's' | 'm' | 'l'", default: "'m'" },
                    {
                        name: 'color',
                        type: "'green' | 'red' | 'yellow' | 'gray' | 'blue'",
                        default: "'green'",
                    },
                ]}
            />

            <ProductUsage>
                <ProductUsage.Example
                    title="Payment success — result badge"
                    path="src/features/payments/shared/components/PaymentSuccessView.tsx"
                    description="Default size (m), green because the payment succeeded."
                    code={`<Card className="flex items-center gap-3 p-4">
  <div className="flex items-center gap-3">
    <IconBubble icon="check" color="green" />
  </div>
  ...
</Card>`}
                >
                    <div className="flex items-center gap-3">
                        <IconBubble icon="check" color="green" />
                        <div className="space-y-1">
                            <p className="text-body-s text-foreground-secondary">Sent to lucia</p>
                            <p className="text-heading-s">$24.00</p>
                        </div>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="KYC processing drawer — head icon"
                    path="src/components/Kyc/modals/KycProcessingModal.tsx"
                    description="Every KYC drawer opens with one bubble above the title. Yellow is the wait, red the failure, blue plain information."
                    code={`<div className="mb-3 flex w-full flex-col items-center gap-4">
  <IconBubble icon="clock" color="yellow" />
  <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
    <DrawerTitle>{t('processingTitle')}</DrawerTitle>
    <DrawerDescription>{t('processingDescription')}</DrawerDescription>
  </DrawerHeader>
</div>`}
                >
                    <div className="flex w-full flex-col items-center gap-4 text-center">
                        <IconBubble icon="clock" color="yellow" />
                        <div className="space-y-2">
                            <p className="text-heading-s">We are checking your details</p>
                            <p className="text-body-s text-foreground-secondary">
                                This takes a few minutes. We tell you when it is done.
                            </p>
                        </div>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
