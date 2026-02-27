import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function AmountInputPage() {
    return (
        <DocPage>
            <DocHeader
                title="AmountInput"
                description="Large currency input with denomination switching, conversion display, balance indicator, and optional slider. Reference page only -- no live demo due to complex context dependencies."
                status="needs-refactor"
            />

            {/* Refactor Note */}
            <DocSection title="Refactor Note">
                <DesignNote type="warning">
                    This component needs refactoring. It has 20+ props, mixes display logic with currency conversion
                    math, and requires multiple setter callbacks. Consider splitting into AmountDisplay (visual) and
                    useAmountConversion (hook) in a future pass.
                </DesignNote>
            </DocSection>

            {/* Visual Description */}
            <DocSection title="Visual Structure">
                <DocSection.Content>
                    <div className="rounded-sm border border-n-1 p-4">
                        <div className="flex flex-col items-center gap-2 py-4">
                            <div className="flex items-center gap-1">
                                <span className="text-xl font-bold text-grey-1">$</span>
                                <span className="text-6xl font-black">0.00</span>
                            </div>
                            <span className="text-lg font-bold text-grey-1">&asymp; ETH 0.00</span>
                            <span className="text-sm text-grey-1">Balance: $ 42.50</span>
                        </div>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-grey-1"></div>
                    </div>
                    <p className="text-xs text-grey-1">
                        The input uses a transparent background with auto-sizing width. A fake blinking caret (primary-1
                        color) shows when the input is empty and not focused.
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import AmountInput from '@/components/Global/AmountInput'`} />

                    <CodeBlock
                        label="Basic (USD only)"
                        code={`<AmountInput
  setPrimaryAmount={setAmount}
  primaryDenomination={{ symbol: '$', price: 1, decimals: 2 }}
/>`}
                    />

                    <CodeBlock
                        label="With conversion"
                        code={`<AmountInput
  setPrimaryAmount={setUsdAmount}
  setSecondaryAmount={setTokenAmount}
  primaryDenomination={{ symbol: '$', price: 1, decimals: 2 }}
  secondaryDenomination={{ symbol: 'ETH', price: ethPrice, decimals: 8 }}
  walletBalance={formattedBalance}
/>`}
                    />

                    <CodeBlock
                        label="With slider (Pot contributions)"
                        code={`<AmountInput
  setPrimaryAmount={setAmount}
  primaryDenomination={{ symbol: '$', price: 1, decimals: 2 }}
  showSlider
  maxAmount={potMax}
  amountCollected={potCollected}
  defaultSliderValue={33}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Props */}
            <DocSection title="Props">
                <PropsTable
                    rows={[
                        {
                            name: 'setPrimaryAmount',
                            type: '(value: string) => void',
                            default: '-',
                            required: true,
                            description: 'Callback for the primary denomination amount',
                        },
                        {
                            name: 'primaryDenomination',
                            type: '{ symbol, price, decimals }',
                            default: "{ symbol: '$', price: 1, decimals: 2 }",
                            description: 'Primary currency config',
                        },
                        {
                            name: 'secondaryDenomination',
                            type: '{ symbol, price, decimals }',
                            default: '(none)',
                            description: 'Enables currency toggle when provided',
                        },
                        {
                            name: 'setSecondaryAmount',
                            type: '(value: string) => void',
                            default: '(none)',
                            description: 'Callback for converted amount',
                        },
                        {
                            name: 'setDisplayedAmount',
                            type: '(value: string) => void',
                            default: '(none)',
                            description: 'Callback for the currently displayed value',
                        },
                        {
                            name: 'setCurrentDenomination',
                            type: '(denomination: string) => void',
                            default: '(none)',
                            description: 'Reports which denomination is active',
                        },
                        { name: 'initialAmount', type: 'string', default: "''", description: 'Pre-fill amount' },
                        {
                            name: 'initialDenomination',
                            type: 'string',
                            default: '(none)',
                            description: 'Pre-select denomination',
                        },
                        {
                            name: 'walletBalance',
                            type: 'string',
                            default: '(none)',
                            description: 'Formatted balance to display',
                        },
                        {
                            name: 'hideBalance',
                            type: 'boolean',
                            default: 'false',
                            description: 'Hide the balance line',
                        },
                        {
                            name: 'hideCurrencyToggle',
                            type: 'boolean',
                            default: 'false',
                            description: 'Hide the swap icon even with secondary denomination',
                        },
                        { name: 'disabled', type: 'boolean', default: 'false', description: 'Disable input' },
                        { name: 'onSubmit', type: '() => void', default: '(none)', description: 'Enter key handler' },
                        { name: 'onBlur', type: '() => void', default: '(none)', description: 'Blur handler' },
                        {
                            name: 'showSlider',
                            type: 'boolean',
                            default: 'false',
                            description: 'Show percentage slider below input',
                        },
                        { name: 'maxAmount', type: 'number', default: '(none)', description: 'Slider max value' },
                        {
                            name: 'amountCollected',
                            type: 'number',
                            default: '0',
                            description: 'Already collected (for pot snap logic)',
                        },
                        {
                            name: 'defaultSliderValue',
                            type: 'number',
                            default: '(none)',
                            description: 'Initial slider percentage',
                        },
                        {
                            name: 'defaultSliderSuggestedAmount',
                            type: 'number',
                            default: '(none)',
                            description: 'Suggested amount to pre-fill',
                        },
                        {
                            name: 'infoContent',
                            type: 'ReactNode',
                            default: '(none)',
                            description: 'Content below the input area',
                        },
                        {
                            name: 'className',
                            type: 'string',
                            default: "''",
                            description: 'Override form container styles',
                        },
                    ]}
                />
            </DocSection>

            {/* Architecture Notes */}
            <DocSection title="Architecture Notes">
                <DesignNote type="info">
                    Internally uses exactValue (scaled by 10^18) for precise integer arithmetic during currency
                    conversion. Display values are formatted separately from calculation values to avoid precision loss.
                </DesignNote>
                <DesignNote type="info">
                    The component auto-focuses on desktop (DeviceType.WEB) but not on mobile to avoid keyboard popup.
                    Input width auto-sizes based on character count (ch units).
                </DesignNote>
                <DesignNote type="warning">
                    The slider has a 33.33% &quot;magnetic snap point&quot; that snaps to the remaining pot amount. This
                    is specific to the pot/group-pay use case and ideally should not be baked into the generic
                    component.
                </DesignNote>
            </DocSection>

            {/* Refactoring Ideas */}
            <DocSection title="Refactoring Ideas">
                <div className="space-y-1 text-sm text-grey-1">
                    <p>1. Extract conversion logic into a useAmountConversion hook</p>
                    <p>2. Split slider into a separate SliderAmountInput wrapper component</p>
                    <p>3. Remove pot-specific snap logic from the base component</p>
                    <p>4. Simplify the 7 callback props into a single onChange object</p>
                    <p>5. Consider using a controlled-only pattern (value + onChange) instead of internal state</p>
                </div>
            </DocSection>
        </DocPage>
    )
}
