'use client'

import Link from 'next/link'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'
import { ProductUsage } from '../../_components/ProductUsage'
import { Icon } from '@/components/Global/Icons/Icon'

const noop = () => {}

export default function LinkButtonPage() {
    return (
        <DocPage>
            <DocHeader
                title="LinkButton"
                description="Standalone link from the figma link board (17980:17351). Body/XS underlined, gray at rest, black on hover. Navigation only — never an action."
                status="limited"
            />

            <DocSection title="Usage & states">
                <DocSection.Content>
                    <div className="flex flex-col items-start gap-4">
                        <LinkButton onClick={noop}>Default</LinkButton>
                        <LinkButton onClick={noop} icon>
                            View transaction
                        </LinkButton>
                        <LinkButton href="/dev/ds" icon>
                            As a Next.js link
                        </LinkButton>
                        <LinkButton onClick={noop} disabled>
                            Disabled
                        </LinkButton>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="LinkButton"
                        code={`import { LinkButton } from '@/components/0_Bruddle/LinkButton'

<LinkButton href="/history" icon>View transaction</LinkButton>
<LinkButton onClick={openDetails}>See details</LinkButton>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Inline links">
                <DocSection.Content>
                    <p className="text-body-m text-foreground-primary">
                        Inline links inherit the surrounding text:{' '}
                        <Link href="/dev/ds" className="text-foreground-secondary underline">
                            transaction history
                        </Link>{' '}
                        stays in the sentence. Do not embed the standalone LinkButton inline — its fixed size and icon
                        break the sentence.
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Inline"
                        code={`You can view your{' '}
<Link href="/history" className="text-foreground-secondary underline">
    transaction history
</Link>{' '}
at any time.`}
                    />
                </DocSection.Code>
            </DocSection>

            <DesignNote type="warning">
                The board colors links foreground/secondary (gray) at rest — the older app law said links are black +
                underline. This page follows the board; the conflict is flagged for a design decision.
            </DesignNote>

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'children', type: 'ReactNode', default: '(required)', description: 'Link text' },
                    {
                        name: 'href',
                        type: 'string',
                        default: '(none)',
                        description: 'Renders a Next.js Link; omit for a button',
                    },
                    { name: 'onClick', type: '() => void', default: '(none)' },
                    { name: 'icon', type: 'boolean', default: 'false', description: 'Trailing arrow-up-right' },
                    { name: 'disabled', type: 'boolean', default: 'false', description: '40% opacity, no clicks' },
                    { name: 'external', type: 'boolean', default: 'false', description: 'Opens href in a new tab' },
                ]}
            />

            <ProductUsage>
                <ProductUsage.Example
                    title="Receipt — download attachment"
                    path="src/components/TransactionDetails/ReceiptDetailsCard.tsx"
                    description="External link with its own trailing icon as a child instead of the built-in arrow."
                    code={`<LinkButton href={transaction.attachmentUrl} external>
    {t('rows.download')}
    <Icon name="download" size={14} className="shrink-0" />
</LinkButton>`}
                >
                    <LinkButton href="https://peanut.me" external>
                        Download
                        <Icon name="download" size={14} className="shrink-0" />
                    </LinkButton>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="QR pay — success screen"
                    path="src/features/payments/flows/qr-pay/views/QrPaySuccessView.tsx"
                    description="Full-width secondary action under the primary button, with a leading icon."
                    code={`<LinkButton onClick={() => setShowInviteFriendsModal(true)} className="w-full justify-center">
    <Icon name="invite-heart" size={16} className="shrink-0" />
    {t('success.inviteFriendsCta')}
</LinkButton>`}
                >
                    <LinkButton onClick={noop} className="w-full justify-center">
                        <Icon name="invite-heart" size={16} className="shrink-0" />
                        Invite friends
                    </LinkButton>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Card — application status"
                    path="src/components/Card/ApplicationStatusScreen.tsx"
                    description="Plain text link as the last resort on a blocked state — contact support, or read the policy."
                    code={`<LinkButton href={PROHIBITED_ACTIVITIES_POLICY_URL} external>
    {t('status.geoBlockedPolicyLink')}
</LinkButton>
<LinkButton onClick={onContactSupport}>{tCommon('contactSupport')}</LinkButton>`}
                >
                    <div className="flex flex-col items-start gap-2">
                        <LinkButton href="https://peanut.me" external>
                            Prohibited activities policy
                        </LinkButton>
                        <LinkButton onClick={noop}>Contact support</LinkButton>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
