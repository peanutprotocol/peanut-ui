'use client'

import React from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { Section } from '@/components/0_Bruddle/Section'
import { CodeBlock } from './CodeBlock'
import { SectionDivider } from './SectionDivider'

// ponytail: static doc chrome — no state, no config. Every DS doc page renders
// its real-product examples through this so the "Used in product" section
// reads the same everywhere.

function ProductUsageRoot({ children }: { children: React.ReactNode }) {
    return (
        <>
            {/* the divider belongs to the section, so every page gets exactly one */}
            <SectionDivider />
            <Section title="Used in product">
                <p className="mt-2 text-body-s text-foreground-secondary">
                    Real call sites from the app, rendered with the same props. The file path is where the code lives.
                </p>
                <div className="space-y-6 mt-6">{children}</div>
            </Section>
        </>
    )
}

function Example({
    title,
    path,
    description,
    code,
    children,
}: {
    /** where in the product this appears, e.g. "KYC consent gate" */
    title: string
    /** repo-relative file path of the real call site */
    path: string
    description?: string
    /** the real snippet from that call site */
    code?: string
    /** live recreation of the call site */
    children: React.ReactNode
}) {
    return (
        <Card className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-label-l">{title}</h3>
                <span className="truncate font-mono text-body-xs text-foreground-secondary/80">{path}</span>
            </div>
            {description && <p className="mt-1 text-body-xs text-foreground-secondary">{description}</p>}
            <div className="mt-4 rounded-sm border border-dashed border-border-subtle bg-background-page p-4">
                {children}
            </div>
            {code && (
                <div className="mt-4">
                    <CodeBlock label="Call site" code={code} />
                </div>
            )}
        </Card>
    )
}

export const ProductUsage = Object.assign(ProductUsageRoot, { Example })
