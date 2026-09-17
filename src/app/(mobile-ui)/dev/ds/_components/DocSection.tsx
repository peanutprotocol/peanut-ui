'use client'

import React, { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { Section } from '@/components/0_Bruddle/Section'

interface DocSectionProps {
    title: string
    description?: string
    children: React.ReactNode
}

function DocSectionRoot({ title, description, children }: DocSectionProps) {
    const [codeVisible, setCodeVisible] = useState(false)

    let contentNode: React.ReactNode = null
    let codeNode: React.ReactNode = null
    let hasCompoundChildren = false

    React.Children.forEach(children, (child) => {
        if (!React.isValidElement(child)) return
        if (child.type === Content) {
            contentNode = child.props.children
            hasCompoundChildren = true
        }
        if (child.type === Code) {
            codeNode = child.props.children
            hasCompoundChildren = true
        }
    })

    // Backward compat: if no Content/Code wrappers, treat all children as content
    if (!hasCompoundChildren) {
        contentNode = children
    }

    const hasCode = codeNode !== null

    return (
        <section className={hasCode ? 'lg:grid lg:grid-cols-2 lg:gap-10' : ''}>
            {/* Left: title + description + content */}
            <Section title={title}>
                <div className="flex items-center gap-2 lg:hidden">
                    {hasCode && (
                        <Button
                            variant="stroke"
                            size="small"
                            className="w-auto"
                            onClick={() => setCodeVisible(!codeVisible)}
                            aria-label={codeVisible ? 'Hide code' : 'Show code'}
                        >
                            {codeVisible ? 'Hide code' : 'Show code'}
                        </Button>
                    )}
                </div>
                {description && <p className="mt-2 text-body-s text-foreground-secondary">{description}</p>}
                {/* space-y-4 = L/16 within-group gap (design.md spacing anatomy) — the
                    content column owns the stack rhythm so pages don't sprinkle margins */}
                <div className="space-y-4 mt-6">{contentNode}</div>
            </Section>

            {/* Right: code */}
            {hasCode && (
                <div className={`mt-6 lg:mt-0 ${codeVisible ? 'block' : 'hidden'} lg:block`}>
                    <Card className="space-y-6 bg-background-badge-accent/20 p-4">{codeNode}</Card>
                </div>
            )}
        </section>
    )
}

function Content({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

function Code({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

export const DocSection = Object.assign(DocSectionRoot, { Content, Code })
