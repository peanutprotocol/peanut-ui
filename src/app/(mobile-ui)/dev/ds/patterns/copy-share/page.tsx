'use client'

import CopyField from '@/components/Global/CopyField'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import MoreInfo from '@/components/Global/MoreInfo'
import Badge from '@/components/Global/Badges/Badge'
import { Callout } from '@/components/0_Bruddle/Callout'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { WhenToUse } from '../../_components/WhenToUse'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

export default function CopySharePage() {
    return (
        <DocPage>
            <DocHeader
                title="Copy & Share"
                description="Components for copying text to clipboard, sharing links, displaying addresses, and showing tooltips."
                status="production"
            />

            <WhenToUse
                use={[
                    'CopyToClipboard beside a value that already has its place on screen — an address, an amount, a reference.',
                    'CopyField when the value needs a full-width read-only field of its own.',
                    'MoreInfo for an explanation worth one tap, instead of a line of body copy.',
                    'The Web Share pattern (navigator.share with a clipboard fallback) to share a link out of the app.',
                ]}
                dontUse={[
                    'CopyField where the value already sits in its own layout. → an inline CopyToClipboard is enough.',
                    'A native title attribute for a hint. → use MoreInfo, which is portaled and keeps clear of the viewport edge.',
                    'A toast to confirm a copy — both controls already show their own copied state.',
                ]}
            />

            {/* CopyField */}
            <DocSection title="CopyField">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Input field + Copy button combo. The input is disabled (read-only display). Button shows
                        &quot;Copied&quot; feedback for 3 seconds.
                    </p>

                    <div className="space-y-3">
                        <CopyField text="https://peanut.me/claim/abc123" />
                        <CopyField text="0x1234...abcd" variant="primary" shadowSize="4" />
                    </div>

                    <PropsTable
                        rows={[
                            {
                                name: 'text',
                                type: 'string',
                                default: '-',
                                required: true,
                                description: 'Text to display and copy',
                            },
                            {
                                name: 'variant',
                                type: 'ButtonVariant',
                                default: "'secondary'",
                                description: 'Copy button variant',
                            },
                            {
                                name: 'shadowSize',
                                type: "'4' | '6' | '8'",
                                default: '(none)',
                                description: 'Copy button shadow',
                            },
                            { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables copying' },
                            {
                                name: 'onDisabledClick',
                                type: '() => void',
                                default: '(none)',
                                description: 'Handler when clicking disabled button',
                            },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import CopyField from '@/components/Global/CopyField'`} />

                    <CodeBlock
                        label="Usage"
                        code={`<CopyField text="https://peanut.me/claim/abc123" />
<CopyField text={linkUrl} variant="primary" shadowSize="4" />`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* CopyToClipboard */}
            <DocSection title="CopyToClipboard">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Icon-only or button-style copy trigger. Shows check icon for 2 seconds after copying. Supports
                        imperative copy via ref.
                    </p>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-body-xs">Icon mode:</span>
                                <CopyToClipboard textToCopy="Hello from Peanut!" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-body-xs">DS sizes:</span>
                                <CopyToClipboard textToCopy="small" iconSize="4" />
                                <CopyToClipboard textToCopy="medium" iconSize="5" />
                                <CopyToClipboard textToCopy="large" iconSize="6" />
                            </div>
                        </div>
                        <div>
                            <CopyToClipboard textToCopy="Button mode text" type="button" />
                        </div>
                    </div>

                    <PropsTable
                        rows={[
                            {
                                name: 'textToCopy',
                                type: 'string',
                                default: '-',
                                required: true,
                                description: 'Text to copy to clipboard',
                            },
                            {
                                name: 'type',
                                type: "'icon' | 'button'",
                                default: "'icon'",
                                description: 'Render as icon or Button component',
                            },
                            {
                                name: 'iconSize',
                                type: "'2' | '3' | '4' | '5' | '6' | '8'",
                                default: "'6'",
                                description: 'Use 4, 5, or 6 for the 16px, 20px, or 24px DS steps',
                            },
                            { name: 'fill', type: 'string', default: "'black'", description: 'Icon fill color' },
                            {
                                name: 'buttonSize',
                                type: 'ButtonSize',
                                default: '(none)',
                                description: 'Button size when type="button"',
                            },
                            { name: 'className', type: 'string', default: "''", description: 'Override styles' },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import CopyToClipboard from '@/components/Global/CopyToClipboard'`}
                    />

                    <CodeBlock
                        label="Usage"
                        code={`{/* Icon (default) */}
<CopyToClipboard textToCopy={address} />

{/* Button */}
<CopyToClipboard textToCopy={code} type="button" />

{/* Imperative */}
const copyRef = useRef<CopyToClipboardRef>(null)
<CopyToClipboard ref={copyRef} textToCopy={text} />
copyRef.current?.copy()`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* ShareButton */}
            <DocSection title="ShareButton">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Reference only. Uses the Web Share API (navigator.share) with clipboard fallback. Typically
                        composed inline rather than imported as a standalone component.
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Pattern"
                        code={`<Button
  variant="primary"
  icon="share"
  onClick={() => {
    if (navigator.share) {
      navigator.share({ url, title })
    } else {
      navigator.clipboard.writeText(url)
    }
  }}
>
  Share
</Button>`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* MoreInfo */}
            <DocSection title="MoreInfo">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Info icon that toggles a positioned tooltip on click. Uses HeadlessUI Menu and createPortal for
                        correct z-indexing.
                    </p>

                    <div className="flex items-center gap-2 rounded-sm border border-border-default p-3">
                        <span className="text-body-s">Network fee</span>
                        <MoreInfo text="This is the gas fee required to process your transaction on the blockchain. It varies based on network congestion." />
                    </div>

                    <PropsTable
                        rows={[
                            {
                                name: 'text',
                                type: 'string | ReactNode',
                                default: '-',
                                required: true,
                                description: 'Tooltip content',
                            },
                            {
                                name: 'html',
                                type: 'boolean',
                                default: 'false',
                                description: 'Render text as HTML (dangerouslySetInnerHTML)',
                            },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import MoreInfo from '@/components/Global/MoreInfo'`} />

                    <CodeBlock
                        label="Usage"
                        code={`<span>Network fee</span>
<MoreInfo text="Gas fee for processing the transaction." />`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Design Notes */}
            <DocSection title="Design Rules">
                <DesignNote type="info">
                    CopyField for displaying + copying full strings (links, codes). CopyToClipboard for inline copy
                    icons next to existing text.
                </DesignNote>
                <DesignNote type="info">
                    MoreInfo tooltip is portaled to document.body and auto-positions to avoid viewport edges. Preferred
                    over native title attributes.
                </DesignNote>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Add money — crypto deposit address"
                    path="src/components/AddMoney/views/CryptoDeposit.view.tsx"
                    description="iconSize 4 (16px) beside a truncated address. The first and last six characters are bold — that is the part a user checks against their wallet."
                    code={`<div className="flex items-center gap-2">
  <p className="truncate">
    <span className="font-semibold">{address.slice(0, 6)}</span>
    {address.slice(6, -6)}
    <span className="font-semibold">{address.slice(-6)}</span>
  </p>
  <CopyToClipboard
    textToCopy={depositAddressData.depositAddress}
    iconSize="4"
    className="flex-shrink-0"
  />
</div>`}
                >
                    <div className="flex items-center gap-2">
                        <p className="truncate text-body-s">
                            <span className="font-semibold">0x1a2b3c</span>
                            4d5e6f7a8b9c0d1e2f3a4b5c
                            <span className="font-semibold">6d7e8f</span>
                        </p>
                        <CopyToClipboard
                            textToCopy="0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f"
                            iconSize="4"
                            className="flex-shrink-0"
                        />
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Add money — the exact amount to transfer"
                    path="src/components/AddMoney/components/AddMoneyBankDetails.tsx"
                    description="The copy icon sits on the baseline of a heading. Same screen copies the deposit reference the same way — both values must reach the bank app character for character."
                    code={`<Card className="p-4">
  <p className="text-body-xs text-foreground-secondary">{t('bankDetails.amountToSend')}</p>
  <div className="flex items-baseline gap-2">
    <p className="text-heading-s text-foreground-primary md:text-heading-l">
      {formattedCurrencyAmount}
    </p>
    <CopyToClipboard textToCopy={formattedCurrencyAmount} fill="black" iconSize="4" />
  </div>
  <Callout priority="attention" className="mt-4">{t('bankDetails.sendExactAmount')}</Callout>
</Card>`}
                >
                    <div>
                        <p className="text-body-xs text-foreground-secondary">Amount to send</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-heading-s text-foreground-primary">R$ 250,00</p>
                            <CopyToClipboard textToCopy="250,00" fill="black" iconSize="4" />
                        </div>
                        <Callout priority="attention" className="mt-4">
                            Send this exact amount, or the deposit will not match.
                        </Callout>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Add money — Rhino deposit address"
                    path="src/components/AddMoney/views/RhinoDeposit.view.tsx"
                    description="The only CopyField call site in the app. Everywhere else the value already has its own place on screen, so an inline CopyToClipboard is enough."
                    code={`<CopyField text={depositAddressData.depositAddress} />`}
                >
                    <CopyField text="0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f" />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Deposit accounts — why the account count is capped"
                    path="src/features/deposit-accounts/components/AccountsHubList.tsx"
                    description="MoreInfo beside a counter badge in a section heading. The reason is one tap away instead of taking a line of its own."
                    code={`<span className="flex shrink-0 items-center gap-1" data-testid="account-counter">
  <Badge status="neutral" customText={t('list.accountCounter', { used, cap })} />
  <MoreInfo text={t('list.accountLimitWhy')} />
</span>`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-heading-card text-foreground-primary">Virtual accounts</span>
                        <span className="flex shrink-0 items-center gap-1">
                            <Badge status="neutral" customText="2 of 3" />
                            <MoreInfo text="Each account is opened with a partner bank, so the number you can hold at once is limited. Contact support if you need more." />
                        </span>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
