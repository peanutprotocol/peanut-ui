'use client'

import CopyToClipboard from '@/components/Global/CopyToClipboard'

interface CodeBlockProps {
    code: string
    label?: string
}

export function CodeBlock({ code, label }: CodeBlockProps) {
    return (
        <div>
            <div className="flex items-center justify-between">
                {label && <span className="text-label-m text-foreground-secondary uppercase">{label}</span>}
                <CopyToClipboard textToCopy={code} iconSize="4" className="ml-auto text-foreground-secondary" />
            </div>
            <pre className="mt-2 overflow-x-auto font-mono text-body-s">
                <code>{code}</code>
            </pre>
        </div>
    )
}
