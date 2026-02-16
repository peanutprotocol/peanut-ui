'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { WhenToUse } from '../../_components/WhenToUse'
import { DoDont } from '../../_components/DoDont'
import { SectionDivider } from '../../_components/SectionDivider'
import { Playground } from '../../_components/Playground'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { StatusTag } from '../../_components/StatusTag'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function ButtonPage() {
    return (
        <DocPage>
            <DocHeader
                title="Button"
                description="Primary interaction component. Supports variants, sizes, shadows, icons, loading, and long-press."
                status="production"
                usages="120+ usages"
            />

            <WhenToUse
                use={[
                    'Primary and secondary CTAs in flows',
                    'Actions that submit, confirm, or navigate forward',
                    'Icon + label combinations for contextual actions (share, copy)',
                ]}
                dontUse={[
                    'Navigation links — use Next.js Link instead',
                    'Toggle states — use Checkbox or Switch',
                    'Inline text actions — use underlined text links',
                ]}
            />

            <DoDont
                doExample={
                    <Button variant="purple" shadowSize="4" className="w-full">
                        Continue
                    </Button>
                }
                doLabel='Default height (no size prop) for primary CTAs'
                dontExample={
                    <Button variant="purple" size="large" className="w-full">
                        Continue
                    </Button>
                }
                dontLabel='size="large" is actually shorter (h-10 vs h-13)'
            />

            <SectionDivider />

            <DocSection title="Interactive Playground">
                <Playground
                    name="Button"
                    importPath={`import { Button } from '@/components/0_Bruddle/Button'`}
                    defaults={{ variant: 'purple', children: 'Continue', shadowSize: '4' }}
                    controls={[
                        {
                            type: 'select',
                            prop: 'variant',
                            label: 'variant',
                            options: [
                                'purple',
                                'stroke',
                                'primary-soft',
                                'transparent',
                                'dark',
                                'transparent-dark',
                                'transparent-light',
                            ],
                        },
                        {
                            type: 'select',
                            prop: 'size',
                            label: 'size',
                            options: ['small', 'medium', 'large'],
                        },
                        {
                            type: 'select',
                            prop: 'shadowSize',
                            label: 'shadowSize',
                            options: ['3', '4', '6', '8'],
                        },
                        {
                            type: 'select',
                            prop: 'icon',
                            label: 'icon',
                            options: ['share', 'copy', 'check', 'arrow-up-right', 'plus', 'download'],
                        },
                        { type: 'boolean', prop: 'disabled', label: 'disabled' },
                        { type: 'boolean', prop: 'loading', label: 'loading' },
                        { type: 'text', prop: 'children', label: 'label', placeholder: 'Button text' },
                    ]}
                    render={(props) => {
                        const { children, ...rest } = props
                        return (
                            <Button {...rest} className="w-full max-w-xs">
                                {children || 'Button'}
                            </Button>
                        )
                    }}
                    codeTemplate={(props) => {
                        const parts = ['<Button']
                        if (props.variant && props.variant !== 'purple') parts.push(`variant="${props.variant}"`)
                        if (props.size) parts.push(`size="${props.size}"`)
                        if (props.shadowSize) parts.push(`shadowSize="${props.shadowSize}"`)
                        if (props.icon) parts.push(`icon="${props.icon}"`)
                        if (props.disabled) parts.push('disabled')
                        if (props.loading) parts.push('loading')
                        parts.push(`>${props.children || 'Button'}</Button>`)
                        return parts.join(' ')
                    }}
                />
            </DocSection>

            <SectionDivider />

            <DocSection title="Variants" description="Production variants ordered by usage count.">
                <DocSection.Content>
                    <div className="space-y-4">
                        {(
                            [
                                ['purple', '59 usages', 'production'],
                                ['stroke', '27 usages', 'production'],
                                ['primary-soft', '18 usages', 'production'],
                                ['transparent', '12 usages', 'production'],
                                ['dark', '2 usages', 'limited'],
                                ['transparent-dark', '3 usages', 'limited'],
                            ] as const
                        ).map(([variant, count, status]) => (
                            <div key={variant}>
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="text-sm font-bold">{variant}</span>
                                    <span className="text-xs text-grey-1">{count}</span>
                                    <StatusTag status={status} />
                                </div>
                                <Button variant={variant}>{variant}</Button>
                            </div>
                        ))}
                        <div>
                            <div className="mb-2 flex items-center gap-2">
                                <span className="text-sm font-bold">transparent-light</span>
                                <span className="text-xs text-grey-1">2 usages</span>
                                <StatusTag status="limited" />
                            </div>
                            <div className="rounded-sm bg-n-1 p-3">
                                <Button variant="transparent-light">transparent-light</Button>
                            </div>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Variants"
                        code={`<Button variant="purple">Primary</Button>
<Button variant="stroke">Stroke</Button>
<Button variant="primary-soft">Soft</Button>
<Button variant="transparent">Transparent</Button>`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="Sizes">
                <DocSection.Content>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="text-center">
                            <Button variant="stroke">default</Button>
                            <p className="mt-2 text-xs text-grey-1">h-13 (52px)</p>
                        </div>
                        <div className="text-center">
                            <Button variant="stroke" size="small">small</Button>
                            <p className="mt-2 text-xs text-grey-1">h-8 · 29 usages</p>
                        </div>
                        <div className="text-center">
                            <Button variant="stroke" size="medium">medium</Button>
                            <p className="mt-2 text-xs text-grey-1">h-9 · 10 usages</p>
                        </div>
                        <div className="text-center">
                            <Button variant="stroke" size="large">large</Button>
                            <p className="mt-2 text-xs text-grey-1">h-10 · 5 usages</p>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Sizes"
                        code={`{/* Default: h-13 (tallest) */}
<Button>Default</Button>

{/* Named sizes are SHORTER */}
<Button size="small">Small (h-8)</Button>
<Button size="medium">Medium (h-9)</Button>
<Button size="large">Large (h-10)</Button>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Props">
                <PropsTable
                    rows={[
                        { name: 'variant', type: 'ButtonVariant', default: "'purple'", description: 'Visual style' },
                        { name: 'size', type: "'small' | 'medium' | 'large'", default: '(none = h-13)', description: 'Height override. Default is tallest.' },
                        { name: 'shape', type: "'default' | 'square'", default: "'default'" },
                        { name: 'shadowSize', type: "'3' | '4' | '6' | '8'", default: '(none)', description: "'4' is standard (160+ usages)" },
                        { name: 'shadowType', type: "'primary' | 'secondary'", default: "'primary'" },
                        { name: 'loading', type: 'boolean', default: 'false', description: 'Shows spinner, hides icon' },
                        { name: 'icon', type: 'IconName | ReactNode', default: '(none)' },
                        { name: 'iconPosition', type: "'left' | 'right'", default: "'left'" },
                        { name: 'iconSize', type: 'number', default: '(auto)' },
                        { name: 'longPress', type: '{ duration, onLongPress, ... }', default: '(none)', description: 'Hold-to-confirm with progress bar' },
                        { name: 'disableHaptics', type: 'boolean', default: 'false' },
                    ]}
                />
            </DocSection>

            <SectionDivider />

            <DocSection title="Design Rules">
                <div className="space-y-4">
                    <DesignNote type="warning">
                        size=&quot;large&quot; is h-10 — SHORTER than default h-13. Default is the tallest button. Primary
                        CTAs should use NO size prop.
                    </DesignNote>
                    <DesignNote type="info">
                        Primary CTA pattern: variant=&quot;purple&quot; shadowSize=&quot;4&quot; className=&quot;w-full&quot;
                        — no size prop.
                    </DesignNote>
                </div>
            </DocSection>

            <DocSection title="Canonical Patterns">
                <DocSection.Content>
                    <div className="space-y-6">
                        <div>
                            <p className="text-sm font-bold">Primary CTA (most common)</p>
                            <Button variant="purple" shadowSize="4" className="mt-2 w-full">Continue</Button>
                        </div>
                        <div>
                            <p className="text-sm font-bold">Secondary CTA</p>
                            <Button variant="stroke" className="mt-2 w-full">Go Back</Button>
                        </div>
                        <div>
                            <p className="text-sm font-bold">With icon</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Button variant="purple" icon="share">Share</Button>
                                <Button variant="stroke" icon="copy">Copy</Button>
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-bold">States</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Button variant="purple" disabled>Disabled</Button>
                                <Button variant="purple" loading>Loading</Button>
                            </div>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import { Button } from '@/components/0_Bruddle/Button'`}
                    />
                    <CodeBlock
                        label="Primary CTA"
                        code={`<Button variant="purple" shadowSize="4" className="w-full">
  Continue
</Button>`}
                    />
                    <CodeBlock
                        label="Secondary CTA"
                        code={`<Button variant="stroke" className="w-full">
  Go Back
</Button>`}
                    />
                    <CodeBlock
                        label="With icon"
                        code={`<Button variant="purple" icon="share">
  Share
</Button>`}
                    />
                    <CodeBlock
                        label="Loading & Disabled"
                        code={`<Button loading>Loading...</Button>
<Button disabled>Disabled</Button>`}
                    />
                    <CodeBlock
                        label="Long Press"
                        code={`<Button
  longPress={{
    duration: 2000,
    onLongPress: () => handleConfirm(),
  }}
>
  Hold to confirm
</Button>`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
