'use client'

import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { useHighlightedCode } from '../_hooks/useHighlightedCode'

interface CodeBlockProps {
    code: string
    label?: string
    language?: string
}

export function CodeBlock({ code, label, language = 'tsx' }: CodeBlockProps) {
    const html = useHighlightedCode(code, language)

    return (
        <div>
            <div className="flex items-center justify-between">
                {label && <span className="text-label-m text-foreground-secondary uppercase">{label}</span>}
                <CopyToClipboard textToCopy={code} iconSize="4" className="ml-auto text-foreground-secondary" />
            </div>
            <div
                className="shiki-code mt-2 overflow-x-auto rounded-sm text-body-s [&_code]:block [&_pre]:!bg-transparent [&_pre]:p-0"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    )
}
