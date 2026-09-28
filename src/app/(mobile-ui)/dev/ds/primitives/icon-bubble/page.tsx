'use client'

import { IconBubble, type IconBubbleColor } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS, type Concept } from '@/components/0_Bruddle/conceptIcons'
import { type IconName } from '@/components/Global/Icons/Icon'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'

const COLORS: { color: IconBubbleColor; icon: IconName; means: string; useFor: string; never: string }[] = [
    {
        color: 'blue',
        icon: 'bank',
        means: 'A method or plain information',
        useFor: 'Bank, crypto, exchange, links, add money, withdraw, verification, other countries, support, info',
        never: 'A state',
    },
    {
        color: 'yellow',
        icon: 'credit-card',
        means: "Peanut's own, and attention",
        useFor: 'The Peanut user, friends, card, rewards (the star), badges; in a modal or callout: pending, warnings, confirms',
        never: 'An error',
    },
    {
        color: 'brand',
        icon: 'qr-code',
        means: 'The primary action (pink)',
        useFor: 'QR pay, the same pink as the bottom nav QR button',
        never: "Peanut's own things, an error or warning, an implicit default",
    },
    {
        color: 'green',
        icon: 'check',
        means: 'Done',
        useFor: 'Success screens, completed steps, success toasts',
        never: 'A concept',
    },
    {
        color: 'red',
        icon: 'alert',
        means: 'Failed or blocked',
        useFor: 'Errors, blocked flows, destructive confirms, failed-to-load empty states',
        never: 'A concept; something that resolves by waiting',
    },
    {
        color: 'gray',
        icon: 'ban',
        means: 'Inactive',
        useFor: 'Not available, cancelled, empty results, nothing selected',
        never: 'A concept; pending',
    },
]

const STATE_ICONS: { icon: IconName; color: IconBubbleColor; state: string }[] = [
    { icon: 'check', color: 'green', state: 'Done, success' },
    { icon: 'clock', color: 'yellow', state: 'Pending, processing, loading' },
    { icon: 'alert', color: 'yellow', state: 'Warning, confirm' },
    { icon: 'alert', color: 'red', state: 'Error, failed' },
    { icon: 'ban', color: 'red', state: 'Blocked, destructive' },
    { icon: 'info', color: 'blue', state: 'Plain information' },
    { icon: 'search', color: 'gray', state: 'Empty, not found' },
]

const SURFACES = [
    'Pickers (send, add money, withdraw, country lists): the concept bubble, or the flag or brand mark',
    'Activity rows, receipts and Accounts and payments: the concept bubble in its own color whatever the status; the badge says the status',
    'Link rows in activity: the link state bubble (design.md, link state table)',
    'External addresses and wallets as a counterparty: the crypto concept; a flag that fails to load: the bank concept',
    'ActionModal: an icon needs a tone (error, attention, success, info, peanut) or a concept; no implicit color',
    'EmptyState: empty or not found gray, failed to load red',
    'Toasts: the Callout priority color (info blue, success green, attention yellow, helper gray, error red)',
    'Menu and settings rows (card settings, profile menu, profile edit): bare icons, no bubble',
]

export default function IconBubblePage() {
    return (
        <DocPage>
            <DocHeader
                title="IconBubble"
                description="Round colored icon container from the figma icon-bubble board (17802:61528). Six colors, one meaning each."
                status="production"
            />

            <WhenToUse
                use={[
                    'A concept (bank, crypto, card, link…): spread its pair from CONCEPT_ICONS',
                    'A state (done, waiting, failed, inactive): the state icon on the state color',
                    'The leading element of a ListItem (size s), the head above a modal, drawer or card title (size m), the empty or error hero (size l)',
                    'The red bubble in a destructive confirm: there is no red Button variant',
                ]}
                dontUse={[
                    'One country, network or brand: its flag, chain logo or brand mark replaces the bubble',
                    'A person: their avatar (UserAvatar / AvatarWithBadge); never mix an IconBubble color into it',
                    'Navigation rows (card settings, profile menu, profile edit): a bare icon',
                    'A points star or hint next to text: a bare image or Icon at 16',
                    'A composite leading element (a mini-bubble over a logo): the board allows one element',
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

            <DocSection
                title="Colors"
                description="A bubble's color answers one question. A state bubble says how it went; a concept bubble says what it is and never changes with status (TASK-22761, TASK-23054)."
            >
                <DocSection.Content>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-body-s">
                            <thead className="text-foreground-secondary">
                                <tr>
                                    <th className="py-2 pr-4">Color</th>
                                    <th className="py-2 pr-4">Means</th>
                                    <th className="py-2 pr-4">Use for</th>
                                    <th className="py-2">Never for</th>
                                </tr>
                            </thead>
                            <tbody>
                                {COLORS.map((row) => (
                                    <tr key={row.color} className="border-t border-border-default align-top">
                                        <td className="py-2 pr-4">
                                            <div className="flex items-center gap-2">
                                                <IconBubble icon={row.icon} color={row.color} size="s" />
                                                <code>{row.color}</code>
                                            </div>
                                        </td>
                                        <td className="py-2 pr-4">{row.means}</td>
                                        <td className="py-2 pr-4">{row.useFor}</td>
                                        <td className="py-2">{row.never}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <DesignNote type="info">
                        A concept bubble names the concept, never its status: an available and a locked QR row draw the
                        same pink bubble, and the badge beside it says which. A source scan (conceptIconsUsage.test.ts)
                        fails when a call site types a concept&apos;s icon or color itself.
                    </DesignNote>
                </DocSection.Content>
            </DocSection>

            <SectionDivider />

            <DocSection title="State icons" description="One glyph per state, always on its state color.">
                <DocSection.Content>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-body-s">
                            <tbody>
                                {STATE_ICONS.map((row) => (
                                    <tr key={row.state} className="border-t border-border-default align-top">
                                        <td className="py-2 pr-4">
                                            <IconBubble icon={row.icon} color={row.color} size="s" />
                                        </td>
                                        <td className="py-2 pr-4">
                                            <code>{row.icon}</code>
                                        </td>
                                        <td className="py-2">{row.state}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </DocSection.Content>
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
                        Blue is a method or plain information, yellow is Peanut&apos;s own, pink is QR pay. Flags, chain
                        logos and payment-brand marks (Pix, Mercado Pago) are not concepts: they keep their own image in
                        the same slot.
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

            <DocSection title="Per surface" description="Where each rule lands.">
                <DocSection.Content>
                    <ul className="space-y-1 list-disc pl-4 text-body-s">
                        {SURFACES.map((line) => (
                            <li key={line}>{line}</li>
                        ))}
                    </ul>
                </DocSection.Content>
            </DocSection>

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'icon', type: 'IconName | ReactNode', default: '(required)' },
                    { name: 'size', type: "'xs' | 's' | 'm' | 'l'", default: "'m'" },
                    {
                        name: 'color',
                        type: "'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'brand'",
                        default: "'green'",
                        description: 'brand = pink, the primary action (QR pay)',
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
