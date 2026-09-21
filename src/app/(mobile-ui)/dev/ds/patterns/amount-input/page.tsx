'use client'

import { FieldError } from '@/components/0_Bruddle/FieldError'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

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
                    <div className="rounded-sm border border-border-default p-4">
                        <div className="flex flex-col items-center gap-2 py-4">
                            <div className="flex items-center gap-1">
                                <span className="text-heading-xs text-foreground-secondary">$</span>
                                <span className="text-heading-big-input">0.00</span>
                            </div>
                            <span className="text-heading-card text-foreground-secondary">&asymp; ETH 0.00</span>
                            <span className="text-body-s text-foreground-secondary">Balance: $ 42.50</span>
                        </div>
                        <div className="absolute top-1/2 right-4 -translate-y-1/2 text-foreground-secondary"></div>
                    </div>
                    <p className="text-body-xs text-foreground-secondary">
                        The input uses a transparent background with auto-sizing width. An action-primary caret shows
                        when the input is empty and not focused.
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
                <div className="space-y-1 text-body-s text-foreground-secondary">
                    <p>1. Extract conversion logic into a useAmountConversion hook</p>
                    <p>2. Split slider into a separate SliderAmountInput wrapper component</p>
                    <p>3. Remove pot-specific snap logic from the base component</p>
                    <p>4. Simplify the 7 callback props into a single onChange object</p>
                    <p>5. Consider using a controlled-only pattern (value + onChange) instead of internal state</p>
                </div>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Send — amount step"
                    path="src/features/payments/flows/direct-send/views/SendInputView.tsx"
                    description="Dollars only: hideCurrencyToggle drops the swap icon. A logged-out sender has no balance, so hideBalance removes the line rather than showing a zero."
                    code={`{/* amount input + its field error form one column, 4px apart */}
<div className="flex flex-col gap-1">
  <AmountInput
    initialAmount={amount}
    setPrimaryAmount={setAmount}
    onSubmit={handleSubmit}
    walletBalance={isLoggedIn ? formattedBalance : undefined}
    balanceFillAmount={isLoggedIn ? balanceFillAmount : undefined}
    hideBalance={!isLoggedIn}
    hideCurrencyToggle={true}
  />
  {isInsufficientBalance && <FieldError>{t('errors.insufficientPayment')}</FieldError>}
</div>`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1">
                            <span className="text-heading-xs text-foreground-secondary">$</span>
                            <span className="text-heading-big-input">25.00</span>
                        </div>
                        <span className="text-body-s text-foreground-secondary">Balance: $ 42.50</span>
                        <FieldError>Not enough balance</FieldError>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Withdraw — amount step"
                    path="src/features/withdraw/views/WithdrawAmountView.tsx"
                    description="Same shape, but decimals are 6 so the user can pay an exact USDC amount. The comment on that prop is the reason: 2 decimals would round a withdrawal."
                    code={`<AmountInput
  initialAmount={initialAmount}
  setPrimaryAmount={onAmountChange}
  primaryDenomination={{
    symbol: '$',
    price: 1,
    decimals: 6, // we want USDC decimals to be able to pay exactly
  }}
  walletBalance={walletBalance}
  balanceFillAmount={balanceFillAmount}
  onBalanceFilled={onBalanceFilled}
  hideCurrencyToggle
/>`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-center text-heading-xs text-foreground-primary">
                            How much do you want to withdraw?
                        </div>
                        <div className="mt-2 flex items-center gap-1">
                            <span className="text-heading-xs text-foreground-secondary">$</span>
                            <span className="text-heading-big-input">100.482915</span>
                        </div>
                        <span className="text-body-s text-foreground-secondary">Balance: $ 250.00</span>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Contribute to a pot — amount with a slider"
                    path="src/features/payments/flows/contribute-pot/views/ContributePotInputView.tsx"
                    description="The only call site that turns the slider on. maxAmount is what the pot still needs, so the slider is a share of the remainder, not of the balance."
                    code={`<AmountInput
  initialAmount={amount}
  setPrimaryAmount={setAmount}
  onSubmit={handlePayWithPeanut}
  walletBalance={isLoggedIn ? formattedBalance : undefined}
  hideBalance={!isLoggedIn}
  hideCurrencyToggle={true}
  showSlider={remainingAmount > 0}
  maxAmount={remainingAmount}
  defaultSliderValue={sliderDefaults.percentage}
  defaultSliderSuggestedAmount={sliderDefaults.suggestedAmount}
/>`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1">
                            <span className="text-heading-xs text-foreground-secondary">$</span>
                            <span className="text-heading-big-input">30.00</span>
                        </div>
                        <span className="text-body-s text-foreground-secondary">$60.00 left to collect</span>
                        <div className="mt-4 h-1 w-full rounded-full bg-background-disabled">
                            <div className="h-1 w-1/2 rounded-full bg-action-primary" />
                        </div>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
