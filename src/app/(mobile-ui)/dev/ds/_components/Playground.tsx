'use client'

import { useState } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { BaseSelect } from '@/components/0_Bruddle/BaseSelect'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { CodeBlock } from './CodeBlock'

export type PlaygroundControl =
    | { type: 'select'; prop: string; label: string; options: string[] }
    | { type: 'boolean'; prop: string; label: string }
    | { type: 'text'; prop: string; label: string; placeholder?: string }

interface PlaygroundProps {
    name: string
    importPath: string
    defaults: Record<string, any>
    controls: PlaygroundControl[]
    render: (props: Record<string, any>) => React.ReactNode
    codeTemplate: (props: Record<string, any>) => string
}

// dogfood: the playground chrome runs on the primitives it documents —
// Card panels, BaseSelect / BaseInput / Checkbox controls
export function Playground({ importPath, defaults, controls, render, codeTemplate }: PlaygroundProps) {
    const [props, setProps] = useState<Record<string, any>>(defaults)

    const updateProp = (key: string, value: any) => {
        setProps((prev) => ({ ...prev, [key]: value }))
    }

    return (
        <div className="space-y-4">
            {/* Preview */}
            <Card className="border-border-disabled p-6">
                <div className="mb-3 text-label-m text-foreground-secondary uppercase">Preview</div>
                <div className="flex items-center justify-center rounded-sm bg-background-disabled py-8">
                    {render(props)}
                </div>
            </Card>

            {/* Controls */}
            <Card className="border-border-disabled bg-background-page p-4">
                <div className="mb-3 text-label-m text-foreground-secondary uppercase">Controls</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {controls.map((control) => (
                        <ControlField
                            key={control.prop}
                            control={control}
                            value={props[control.prop]}
                            onChange={(v) => updateProp(control.prop, v)}
                        />
                    ))}
                </div>
            </Card>

            {/* Generated code */}
            <CodeBlock code={codeTemplate(props)} label="Code" />
            <CodeBlock code={importPath} label="Import" />
        </div>
    )
}

// sentinel: radix Select items may not carry an empty value string
const NONE = '__none__'

function ControlField({
    control,
    value,
    onChange,
}: {
    control: PlaygroundControl
    value: any
    onChange: (v: any) => void
}) {
    switch (control.type) {
        case 'select':
            return (
                <div>
                    <label className="mb-1 block text-label-m text-foreground-secondary">{control.label}</label>
                    <BaseSelect
                        aria-label={control.label}
                        value={value ?? NONE}
                        onValueChange={(v) => onChange(v === NONE ? undefined : v)}
                        options={[
                            { label: '(none)', value: NONE },
                            ...control.options.map((o) => ({ label: o, value: o })),
                        ]}
                    />
                </div>
            )
        case 'boolean':
            return <Checkbox label={control.label} value={!!value} onChange={(e) => onChange(e.target.checked)} />
        case 'text':
            return (
                <div>
                    <label className="mb-1 block text-label-m text-foreground-secondary">{control.label}</label>
                    <BaseInput
                        variant="sm"
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value || undefined)}
                        placeholder={control.placeholder}
                        aria-label={control.label}
                    />
                </div>
            )
    }
}
