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
        color: 'green',
        icon: 'check',
        means: 'Done',
        useFor: 'Success screens, completed steps, success toasts',
        never: 'A concept',
    },
    {
        color: 'yellow',
        icon: 'clock',
        means: 'Waiting or needs you',
        useFor: 'Pending, processing, loading, warnings, confirms, permissions',
        never: 'A concept',
    },
    {
        color: 'red',
        icon: 'alert',
        means: 'Failed or blocked',
        useFor: 'Failed transactions, errors, blocked flows, destructive confirms, error empty states',
        never: 'Something that resolves by waiting',
    },
    {
        color: 'blue',
        icon: 'bank',
        means: 'A method, an identity object or plain information',
        useFor: 'Bank, crypto, exchange, QR, links, add money, withdraw, Pix key, verification, identity doc, security, support, app update, info, help',
        never: 'A state',
    },
    {
        color: 'brand',
        icon: 'users',
        means: "Peanut's own (pink)",
        useFor: 'The Peanut user, friends, profile, invite, card, rewards, badges, points, balance, notifications, app install',
        never: 'An error or warning; an implicit default',
    },
    {
        color: 'gray',
        icon: 'ban',
        means: 'Inactive',
        useFor: 'Not available, cancelled or refunded history, empty results, nothing selected, region restricted',
        never: 'Pending',
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
    'Activity rows and the receipt head: concept icon, state color; flags, merchant logos and avatars keep their image',
    'Unlock payments: concept icon; available or unlockable in the concept color, waiting yellow, not available gray',
    'Identity verification (activity row, KYC drawers): badge, blue once verified, yellow in review, red failed, gray region restricted',
    'ActionModal: tone is required whenever an icon renders (error, attention, success, info, brand); no implicit color',
    'EmptyState: empty or not found gray, failed to load red',
    'Toasts: the Callout priority color (info blue, success green, attention yellow, helper gray, error red)',
    'Menu and settings rows (card settings, profile menu, profile edit): bare icons, no bubble',
]

const USAGE: { color: IconBubbleColor; icon: IconName; screens: string }[] = [
    {
        color: 'green',
        icon: 'check',
        screens:
            'Payment, QR pay and Manteca withdraw success; Pix QR deposit done; KYC done and additional verification done; fix card signature done steps; post-signup action; scanner "you will be notified"; Unlock payments "what you can do"; success toasts',
    },
    {
        color: 'yellow',
        icon: 'clock',
        screens:
            'Pending and processing activity rows; KYC processing, in progress, re-verification, action required, restart cooldown, Sumsub correction and help warning; QR pay loading, maintenance and verification in progress; claim and pot minimum amounts; address, onramp, token and network confirms; crypto deposit and withdraw warnings; camera permission; card lock and cancel feedback; Rain cooldown; balance warning; corridor gate pending review; Unlock payments processing and attention; show full name; passkey setup help; unsupported browser; attention toasts',
    },
    {
        color: 'red',
        icon: 'alert',
        screens:
            'Failed activity rows; KYC failed and start errors; QR pay blocked and provider rejection; QR claim unavailable; scanner errors; card cancel confirm; cancel deposit and cancel link confirms; receipt unavailable; Unlock payments rejection and error; OTA update failed; Bridge terms error; failed-to-load empty states (home, history, rewards, invites, contacts, direct request, limits, recover funds, explorer, deposit account); error toasts',
    },
    {
        color: 'blue',
        icon: 'bank',
        screens:
            'Bank, crypto, exchange, QR, link, add money, withdraw and other-countries rows in every picker; completed activity rows for those concepts; verification badge; Unlock payments residence, QR, Pix and crypto rows; home activation CTA verify, deposit and QR steps; getting-started money steps; receipt more actions; claim account info; corridor gate support and identity steps; residence change; KYC start, advisory, Bridge terms, provide email, unlock method; Sumsub and KYC iframe help; passkey info; backup FAQ; already claimed; pot "use Peanut balance"; QR pay KYC gate; scanner info modals; terms re-consent; app updates; info toasts',
    },
    {
        color: 'brand',
        icon: 'users',
        screens:
            'Send to friends, Peanut contacts and the P2P row (mascot); card rows in activity, limits, Unlock payments, the card activation step, the checklist and the spend chooser; card gate, PIN, re-enable and auto-balance; rewards and perks (star); badges; public profile; profile backup; guest sign-in; invite friends; getting-started account step; early user; easter egg; app migration; notifications setup',
    },
    {
        color: 'gray',
        icon: 'search',
        screens:
            'Cancelled and refunded activity rows; empty and not-found states (search, contacts, history, rewards, badges, pots, direct send, semantic request, limits, token selector, marketing search); region restricted KYC; closed corridors and locked deposit accounts; Unlock payments not available; nothing picked in the token selector; helper toasts',
    },
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
                description="A bubble's color answers one question. A state bubble says how it went; a concept bubble says what it is and never changes with status."
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
                        Mixed lists (activity rows, the receipt head, Unlock payments, identity verification): icon =
                        the concept, color = the state. Done or active takes the concept color, pending yellow, failed
                        red, cancelled, refunded or not available gray. The map is <code>STATE_BUBBLE_COLORS</code> in
                        conceptIcons; read it through <code>conceptBubbleFor(concept, status)</code>.
                    </DesignNote>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="State on a concept"
                        code={`<IconBubble {...conceptBubbleFor('sendLink', status)} size="s" />`}
                    />
                </DocSection.Code>
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
                        Blue is a method, an identity object or plain information; pink is Peanut&apos;s own. Flags,
                        chain logos and payment-brand marks (Pix, Mercado Pago) are not concepts: they keep their own
                        image in the same slot.
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
                    <ul className="space-y-1 list-disc pl-5 text-body-s">
                        {SURFACES.map((line) => (
                            <li key={line}>{line}</li>
                        ))}
                    </ul>
                </DocSection.Content>
            </DocSection>

            <SectionDivider />

            <DocSection title="Current usage" description="Where each color is used in the app today (TASK-22761).">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        {USAGE.map((row) => (
                            <div key={row.color} className="flex items-start gap-3">
                                <IconBubble icon={row.icon} color={row.color} size="xs" className="mt-0.5" />
                                <p className="text-body-s">
                                    <code>{row.color}</code>: {row.screens}
                                </p>
                            </div>
                        ))}
                    </div>
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
                        description: "brand = pink, Peanut's own",
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
