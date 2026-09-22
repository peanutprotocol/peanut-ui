'use client'

import { Callout } from '@/components/0_Bruddle/Callout'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

const noop = () => {}

export default function CalloutPage() {
    return (
        <DocPage>
            <DocHeader
                title="Callout"
                description="Inline callout banner from the figma notification board (17802:61535). Priority sets tone and icon; supports body or title + body, a checklist body, optional dismiss, and up to two CTAs. It backs every inline banner and error in the app, plus Toast and the Banner announcement surface."
                status="limited"
            />

            <DocSection title="Priority">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Callout priority="info">Just letting you know about this</Callout>
                        <Callout priority="success">Success, details changed</Callout>
                        <Callout priority="attention">Pay attention, this is important</Callout>
                        <Callout priority="helper">Leave empty to let payers choose amount</Callout>
                        <Callout priority="error">Ups, something went wrong</Callout>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Callout"
                        code={`import { Callout } from '@/components/0_Bruddle/Callout'

<Callout priority="success">Success, details changed</Callout>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Build: body vs title + body">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Callout priority="helper">Body text only, no separate title</Callout>
                        <Callout priority="attention" title="Title">
                            Body text can be longer, but try not to go over two lines.
                        </Callout>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Title + body"
                        code={`<Callout priority="attention" title="Title">
    Body text can be longer, but try not to go over two lines.
</Callout>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Checklist (items)">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Callout
                            priority="info"
                            items={[
                                'Europe SEPA transfers (+30 countries)',
                                'UK Faster payments (GBP)',
                                'US ACH and wire transfers',
                                'Mexico SPEI transfers',
                            ]}
                        />
                        <Callout
                            priority="info"
                            title="What you'll unlock"
                            items={['Bank transfers in your country']}
                        />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Checklist"
                        code={`// a checklist carries its own check marks, so it renders
// no leading priority icon, and rows use the dense text step
<Callout
    priority="info"
    items={['Europe SEPA transfers (+30 countries)', 'UK Faster payments (GBP)']}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Dismiss">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Callout priority="info">Not dismissible, no close button</Callout>
                        <Callout priority="info" onDismiss={noop}>
                            Dismissible, includes a close button
                        </Callout>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Dismissible"
                        code={`<Callout priority="info" onDismiss={() => setShown(false)}>
    Dismissible, includes a close button
</Callout>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="CTAs">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Callout priority="attention" ctas={[{ label: 'CTA1', onClick: noop }]}>
                            Single call-to-action button
                        </Callout>
                        <Callout
                            priority="attention"
                            title="Title"
                            onDismiss={noop}
                            ctas={[
                                { label: 'CTA1', onClick: noop },
                                { label: 'CTA2', onClick: noop },
                            ]}
                        >
                            Two buttons: a primary and a secondary action.
                        </Callout>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="CTAs"
                        code={`<Callout
    priority="attention"
    title="Title"
    onDismiss={dismiss}
    ctas={[
        { label: 'Verify', onClick: verify },
        { label: 'Later', onClick: dismiss },
    ]}
>
    Two buttons: a primary and a secondary action.
</Callout>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <PropsTable
                rows={[
                    {
                        name: 'priority',
                        type: "'info' | 'success' | 'attention' | 'helper' | 'error'",
                        default: "'info'",
                        description: 'Tone, background, and leading icon',
                    },
                    { name: 'title', type: 'string', default: '(none)', description: 'Bold first line' },
                    { name: 'children', type: 'ReactNode', default: '(none)', description: 'Body text' },
                    {
                        name: 'items',
                        type: 'ReactNode[]',
                        default: '(none)',
                        description: 'Checklist body — one check row each, no leading icon. Wins over children',
                    },
                    {
                        name: 'onDismiss',
                        type: '() => void',
                        default: '(none)',
                        description: 'Shows the close button',
                    },
                    {
                        name: 'ctas',
                        type: '1-2 × { label, onClick }',
                        default: '(none)',
                        description: 'First renders primary, second secondary',
                    },
                ]}
            />

            <ProductUsage>
                <ProductUsage.Example
                    title="Send — amount step error"
                    path="src/features/payments/flows/direct-send/views/SendInputView.tsx"
                    description="The plainest shape and the most common one: a bare error Callout under the CTA, rendered only when the flow failed."
                    code={`{error.showError && <Callout priority="error">{error.errorMessage}</Callout>}`}
                >
                    <Callout priority="error">Not enough balance to cover this transfer</Callout>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Profile — passkey backup"
                    path="src/app/(mobile-ui)/profile/backup/page.tsx"
                    description="Two stacked callouts on one screen: the warning the user must act on, then a quiet info note about third-party password managers."
                    code={`<Callout priority="attention" title={t('noBackupWarning.title')}>
    {t('noBackupWarning.description')}
</Callout>
{/* Passkeys saved to a third-party manager back up through
    that manager, not the platform steps above. */}
<Callout priority="info">{t('thirdPartyNote')}</Callout>`}
                >
                    <div className="flex flex-col gap-3">
                        <Callout priority="attention" title="No backup yet">
                            If you lose this device you lose access to your account. Turn on passkey backup now.
                        </Callout>
                        <Callout priority="info">
                            Passkeys saved to a password manager back up through that manager.
                        </Callout>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Deposit accounts — claim screen footer"
                    path="src/features/deposit-accounts/components/ClaimAccountScreen.tsx"
                    description="One Callout slot, three outcomes: the not-yet gate, or the claim error carrying a support CTA. They replace each other rather than stack."
                    code={`{isUnavailable ? (
    <Callout priority="attention" title={t('gate.notYetTitle')}>{t('gate.notYetBody')}</Callout>
) : error ? (
    <Callout
        priority="error"
        title={t('claim.errorTitle')}
        ctas={onContactSupport ? [{ label: t('gate.supportCta'), onClick: onContactSupport }] : undefined}
    >
        {error}
    </Callout>
) : (…)}`}
                >
                    <Callout
                        priority="error"
                        title="We could not open your account"
                        ctas={[{ label: 'Contact support', onClick: noop }]}
                    >
                        Something went wrong on our side. Try again, or reach out and we will sort it.
                    </Callout>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
