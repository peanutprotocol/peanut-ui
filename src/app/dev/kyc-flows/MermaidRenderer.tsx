'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import DevPageShell from '@/app/(mobile-ui)/dev/_components/DevPageShell'
import { Card } from '@/components/0_Bruddle/Card'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Section } from '@/components/0_Bruddle/Section'

interface Props {
    diagrams: Array<{ title: string; code: string }>
    source: string
}

export function MermaidRenderer({ diagrams, source }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [errors, setErrors] = useState<Record<number, string>>({})

    useEffect(() => {
        const init = async () => {
            // @ts-expect-error - loaded via CDN script
            const mermaid = window.mermaid
            if (!mermaid) return

            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose',
                flowchart: { useMaxWidth: true, htmlLabels: true },
                stateDiagram: { useMaxWidth: true },
            })

            const nodes = containerRef.current?.querySelectorAll('.mermaid-diagram')
            if (!nodes) return

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i] as HTMLElement
                const code = node.getAttribute('data-code')
                if (!code) continue

                try {
                    const { svg } = await mermaid.render(`mermaid-${i}`, code)
                    node.innerHTML = svg
                } catch (e) {
                    node.replaceChildren()
                    setErrors((current) => ({ ...current, [i]: String(e) }))
                }
            }
        }

        const check = setInterval(() => {
            // @ts-expect-error - loaded via CDN script
            if (window.mermaid) {
                clearInterval(check)
                init()
            }
        }, 100)

        return () => clearInterval(check)
    }, [])

    return (
        <>
            <Script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js" strategy="afterInteractive" />
            <DevPageShell
                title="KYC state machines"
                description={`${diagrams.length} diagrams loaded from the Mono repository.`}
            >
                <div ref={containerRef} className="flex min-w-0 flex-col gap-8">
                    <Callout priority="info" title="Source">
                        <code className="font-mono text-body-xs break-all">{source}</code>
                    </Callout>

                    {diagrams.map((d, i) => (
                        <Section key={i} title={d.title}>
                            {errors[i] ? (
                                <Callout priority="error" title="Diagram render failed">
                                    <pre className="font-mono text-body-xs whitespace-pre-wrap">{errors[i]}</pre>
                                </Callout>
                            ) : (
                                <Card
                                    className="mermaid-diagram min-h-50 items-center justify-center overflow-auto p-4 text-body-s text-foreground-secondary"
                                    data-code={d.code}
                                >
                                    Loading diagram…
                                </Card>
                            )}
                        </Section>
                    ))}
                </div>
            </DevPageShell>
        </>
    )
}
