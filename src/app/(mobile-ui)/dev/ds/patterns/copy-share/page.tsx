'use client'

import CopyField from '@/components/Global/CopyField'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import MoreInfo from '@/components/Global/MoreInfo'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function CopySharePage() {
    return (
        <DocPage>
            <DocHeader
                title="Copy & Share"
                description="Components for copying text to clipboard, sharing links, displaying addresses, and showing tooltips."
                status="production"
            />

            {/* CopyField */}
            <DocSection title="CopyField">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        Input field + Copy button combo. The input is disabled (read-only display). Button shows
                        &quot;Copied&quot; feedback for 3 seconds.
                    </p>

                    <div className="space-y-3">
                        <CopyField text="https://peanut.to/claim/abc123" />
                        <CopyField text="0x1234...abcd" variant="purple" shadowSize="4" />
                    </div>

                    <PropsTable
                        rows={[
                            { name: 'text', type: 'string', default: '-', required: true, description: 'Text to display and copy' },
                            { name: 'variant', type: 'ButtonVariant', default: "'stroke'", description: 'Copy button variant' },
                            { name: 'shadowSize', type: "'4' | '6' | '8'", default: '(none)', description: 'Copy button shadow' },
                            { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables copying' },
                            { name: 'onDisabledClick', type: '() => void', default: '(none)', description: 'Handler when clicking disabled button' },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import CopyField from '@/components/Global/CopyField'`} />

                    <CodeBlock label="Usage" code={`<CopyField text="https://peanut.to/claim/abc123" />
<CopyField text={linkUrl} variant="purple" shadowSize="4" />`} />
                </DocSection.Code>
            </DocSection>

            {/* CopyToClipboard */}
            <DocSection title="CopyToClipboard">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        Icon-only or button-style copy trigger. Shows check icon for 2 seconds after copying.
                        Supports imperative copy via ref.
                    </p>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs">Icon mode:</span>
                                <CopyToClipboard textToCopy="Hello from Peanut!" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs">Different sizes:</span>
                                <CopyToClipboard textToCopy="small" iconSize="3" />
                                <CopyToClipboard textToCopy="medium" iconSize="4" />
                                <CopyToClipboard textToCopy="large" iconSize="6" />
                            </div>
                        </div>
                        <div>
                            <CopyToClipboard textToCopy="Button mode text" type="button" />
                        </div>
                    </div>

                    <PropsTable
                        rows={[
                            { name: 'textToCopy', type: 'string', default: '-', required: true, description: 'Text to copy to clipboard' },
                            { name: 'type', type: "'icon' | 'button'", default: "'icon'", description: 'Render as icon or Button component' },
                            { name: 'iconSize', type: "'2' | '3' | '4' | '6' | '8'", default: "'6'", description: 'Icon size (Tailwind scale)' },
                            { name: 'fill', type: 'string', default: "'black'", description: 'Icon fill color' },
                            { name: 'buttonSize', type: 'ButtonSize', default: '(none)', description: 'Button size when type="button"' },
                            { name: 'className', type: 'string', default: "''", description: 'Override styles' },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import CopyToClipboard from '@/components/Global/CopyToClipboard'`} />

                    <CodeBlock label="Usage" code={`{/* Icon (default) */}
<CopyToClipboard textToCopy={address} />

{/* Button */}
<CopyToClipboard textToCopy={code} type="button" />

{/* Imperative */}
const copyRef = useRef<CopyToClipboardRef>(null)
<CopyToClipboard ref={copyRef} textToCopy={text} />
copyRef.current?.copy()`} />
                </DocSection.Code>
            </DocSection>

            {/* ShareButton */}
            <DocSection title="ShareButton">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        Reference only. Uses the Web Share API (navigator.share) with clipboard fallback.
                        Typically composed inline rather than imported as a standalone component.
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Pattern" code={`<Button
  variant="purple"
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
</Button>`} />
                </DocSection.Code>
            </DocSection>

            {/* AddressLink */}
            <DocSection title="AddressLink">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        Displays a shortened crypto address as a link. Resolves ENS names for Ethereum addresses.
                        Links to the user profile page.
                    </p>

                    <DesignNote type="warning">
                        AddressLink uses usePrimaryName hook (ENS resolution) which requires JustAName provider context.
                        Cannot demo in isolation. Showing code example only.
                    </DesignNote>

                    <PropsTable
                        rows={[
                            { name: 'address', type: 'string', default: '-', required: true, description: 'Crypto address or ENS name' },
                            { name: 'isLink', type: 'boolean', default: 'true', description: 'Render as link or plain text' },
                            { name: 'className', type: 'string', default: "''", description: 'Override styles' },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import AddressLink from '@/components/Global/AddressLink'`} />

                    <CodeBlock label="Usage" code={`<AddressLink address="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18" />
<AddressLink address={senderAddress} isLink={false} />`} />
                </DocSection.Code>
            </DocSection>

            {/* MoreInfo */}
            <DocSection title="MoreInfo">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        Info icon that toggles a positioned tooltip on click. Uses HeadlessUI Menu and createPortal for
                        correct z-indexing.
                    </p>

                    <div className="flex items-center gap-2 rounded-sm border border-n-1 p-3">
                        <span className="text-sm">Network fee</span>
                        <MoreInfo text="This is the gas fee required to process your transaction on the blockchain. It varies based on network congestion." />
                    </div>

                    <PropsTable
                        rows={[
                            { name: 'text', type: 'string | ReactNode', default: '-', required: true, description: 'Tooltip content' },
                            { name: 'html', type: 'boolean', default: 'false', description: 'Render text as HTML (dangerouslySetInnerHTML)' },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import MoreInfo from '@/components/Global/MoreInfo'`} />

                    <CodeBlock label="Usage" code={`<span>Network fee</span>
<MoreInfo text="Gas fee for processing the transaction." />`} />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Design Notes */}
            <DocSection title="Design Rules">
                <DesignNote type="info">
                    CopyField for displaying + copying full strings (links, codes). CopyToClipboard for inline copy icons
                    next to existing text.
                </DesignNote>
                <DesignNote type="info">
                    MoreInfo tooltip is portaled to document.body and auto-positions to avoid viewport edges. Preferred
                    over native title attributes.
                </DesignNote>
            </DocSection>
        </DocPage>
    )
}
