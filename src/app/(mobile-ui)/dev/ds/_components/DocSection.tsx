'use client'

import React, { useState } from 'react'

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
            <div>
                <div className="flex items-center gap-2">
                    <h2 className="text-h5">{title}</h2>
                    {hasCode && (
                        <button
                            onClick={() => setCodeVisible(!codeVisible)}
                            className="flex items-center gap-1 rounded-sm border border-gray-3 px-1.5 py-0.5 text-[10px] font-bold text-grey-1 lg:hidden"
                            aria-label={codeVisible ? 'Hide code' : 'Show code'}
                        >
                            &lt;/&gt;
                        </button>
                    )}
                </div>
                {description && <p className="mt-2 text-sm text-grey-1">{description}</p>}
                <div className="mt-6">{contentNode}</div>
            </div>

            {/* Right: code */}
            {hasCode && (
                <div className={`mt-6 lg:mt-0 ${codeVisible ? 'block' : 'hidden'} lg:block`}>
                    <div className="space-y-6 rounded-sm bg-primary-3/10 p-4">{codeNode}</div>
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
