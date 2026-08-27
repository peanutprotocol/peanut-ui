'use client'

import { useState } from 'react'
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

export function Playground({ importPath, defaults, controls, render, codeTemplate }: PlaygroundProps) {
    const [props, setProps] = useState<Record<string, any>>(defaults)

    const updateProp = (key: string, value: any) => {
        setProps((prev) => ({ ...prev, [key]: value }))
    }

    return (
        <div className="space-y-4">
            {/* Preview */}
            <div className="rounded-sm border border-border-disabled bg-background-default p-6">
                <div className="mb-3 text-label-m text-foreground-secondary uppercase">Preview</div>
                <div className="flex items-center justify-center rounded-sm bg-background-disabled py-8">
                    {render(props)}
                </div>
            </div>

            {/* Controls */}
            <div className="rounded-sm border border-border-disabled bg-background-page p-4">
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
            </div>

            {/* Generated code */}
            <CodeBlock code={codeTemplate(props)} label="Code" />
            <CodeBlock code={importPath} label="Import" />
        </div>
    )
}

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
                    <select
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value || undefined)}
                        className="w-full rounded-sm border border-border-subtle bg-background-default px-2 py-2 text-body-xs"
                    >
                        <option value="">(none)</option>
                        {control.options.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>
            )
        case 'boolean':
            return (
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={!!value}
                        onChange={(e) => onChange(e.target.checked)}
                        className="size-4 rounded-sm border border-border-default"
                    />
                    <label className="text-label-m text-foreground-secondary">{control.label}</label>
                </div>
            )
        case 'text':
            return (
                <div>
                    <label className="mb-1 block text-label-m text-foreground-secondary">{control.label}</label>
                    <input
                        type="text"
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value || undefined)}
                        placeholder={control.placeholder}
                        className="w-full rounded-sm border border-border-subtle bg-background-default px-2 py-2 text-body-xs"
                    />
                </div>
            )
    }
}
