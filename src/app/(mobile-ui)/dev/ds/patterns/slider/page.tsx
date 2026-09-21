'use client'

import { useState } from 'react'
import { Slider } from '@/components/Global/Slider'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'
import { ProductUsage } from '../../_components/ProductUsage'

export default function SliderPage() {
    const [value, setValue] = useState([50])

    return (
        <DocPage>
            <DocHeader
                title="Slider"
                description="Percentage slider from the figma slider board (17802:61531), radix base. Magnetic snapping to 25 / 33.3 / 50 / 100%. Consumer: AmountInput (contribute-pot flow)."
                status="production"
            />

            <DocSection title="Interactive">
                <DocSection.Content>
                    <div className="flex flex-col gap-8 pb-6">
                        <Slider value={value} onValueChange={setValue} aria-label="demo slider" />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Slider"
                        code={`import { Slider } from '@/components/Global/Slider'

const [value, setValue] = useState([50])

<Slider value={value} onValueChange={setValue} aria-label="Contribution percentage" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Positions">
                <DocSection.Content>
                    <div className="flex flex-col gap-8 pb-6">
                        <Slider value={[0]} onValueChange={() => {}} aria-label="slider at 0" />
                        <Slider value={[25]} onValueChange={() => {}} aria-label="slider at 25" />
                        <Slider value={[75]} onValueChange={() => {}} aria-label="slider at 75" />
                        <Slider value={[100]} onValueChange={() => {}} aria-label="slider at 100" />
                    </div>
                </DocSection.Content>
            </DocSection>

            <SectionDivider />

            <DocSection title="Disabled">
                <DocSection.Content>
                    <div className="pb-6">
                        <Slider value={[100]} onValueChange={() => {}} disabled aria-label="disabled slider" />
                    </div>
                </DocSection.Content>
            </DocSection>

            <DesignNote type="info">
                The board tops out at 100% — this consumer allows up to 120% of the suggested amount, so the right label
                reads 120%. The fill is always pink: never recolor it green or red as an indicator.
            </DesignNote>

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'value', type: 'number[]', default: '(uncontrolled)', description: 'Controlled value' },
                    { name: 'onValueChange', type: '(v: number[]) => void', default: '(none)' },
                    { name: 'defaultValue', type: 'number[]', default: '[100]' },
                    { name: 'disabled', type: 'boolean', default: 'false', description: '50% opacity, no drag' },
                    {
                        name: '...radix props',
                        type: 'SliderPrimitive.Root',
                        default: '—',
                        description: 'min 0, max 120, step 1 by default (overridable)',
                    },
                ]}
            />

            <ProductUsage>
                <ProductUsage.Example
                    title="Contribute to a pot — how much of the rest you pay"
                    path="src/features/payments/flows/contribute-pot/views/ContributePotInputView.tsx"
                    description="The only place in the app that shows a Slider. Nothing imports it directly: AmountInput owns it behind showSlider, and contribute-pot is the one caller that sets that prop. The percentage is of what the pot still needs, not of your balance."
                    code={`{/* the only showSlider call site — AmountInput renders the Slider */}
<AmountInput
  setPrimaryAmount={setAmount}
  hideCurrencyToggle={true}
  showSlider={remainingAmount > 0}
  maxAmount={remainingAmount}
  defaultSliderValue={sliderDefaults.percentage}
  defaultSliderSuggestedAmount={sliderDefaults.suggestedAmount}
/>

{/* inside AmountInput */}
<Slider
  onValueChange={onSliderValueChange}
  defaultValue={[defaultSliderValue ? defaultSliderValue : 100]}
/>`}
                >
                    <div className="flex flex-col gap-6 pb-6">
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                                <span className="text-heading-xs text-foreground-secondary">$</span>
                                <span className="text-heading-big-input">30.00</span>
                            </div>
                            <span className="text-body-s text-foreground-secondary">$60.00 left to collect</span>
                        </div>
                        <Slider value={[50]} onValueChange={() => {}} aria-label="contribution percentage" />
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
