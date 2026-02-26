import React from 'react'

function DocPageRoot({ children }: { children: React.ReactNode }) {
    // Extract Design/Code children for backward compat, or render directly
    const extracted: React.ReactNode[] = []

    React.Children.forEach(children, (child) => {
        if (!React.isValidElement(child)) {
            extracted.push(child)
            return
        }
        if (child.type === Design) {
            // Unwrap Design children directly
            extracted.push(child.props.children)
        } else if (child.type === Code) {
            // Skip Code — code now lives inside DocSection.Code
        } else {
            extracted.push(child)
        }
    })

    return <div className="space-y-16">{extracted}</div>
}

function Design({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

function Code({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

export const DocPage = Object.assign(DocPageRoot, { Design, Code })
