'use client'

import { useEffect, useRef } from 'react'
import Script from 'next/script'

interface Props {
    diagrams: Array<{ title: string; code: string }>
    source: string
}

export function MermaidRenderer({ diagrams, source }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)

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
                    node.innerHTML = `<pre style="color:red">${e}</pre>`
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
            <div
                ref={containerRef}
                style={{
                    maxWidth: 1200,
                    margin: '0 auto',
                    padding: '40px 20px',
                    fontFamily: 'system-ui, sans-serif',
                }}
            >
                <h1 style={{ fontSize: 28, marginBottom: 8 }}>KYC Flows — State Machine Reference</h1>
                <p style={{ color: '#666', marginBottom: 16 }}>
                    {diagrams.length} diagrams loaded from mono repo. Source:{' '}
                    <code style={{ fontSize: 12 }}>{source}</code>
                </p>
                <p style={{ color: '#999', marginBottom: 40, fontSize: 13 }}>
                    edit the markdown in mono, refresh this page to see changes.
                </p>

                {diagrams.map((d, i) => (
                    <section key={i} style={{ marginBottom: 60 }}>
                        <h2
                            style={{ fontSize: 20, marginBottom: 16, borderBottom: '1px solid #eee', paddingBottom: 8 }}
                        >
                            {d.title}
                        </h2>
                        <div
                            className="mermaid-diagram"
                            data-code={d.code}
                            style={{
                                background: '#fafafa',
                                border: '1px solid #eee',
                                borderRadius: 4,
                                padding: 20,
                                minHeight: 200,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <span style={{ color: '#999' }}>Loading diagram...</span>
                        </div>
                    </section>
                ))}
            </div>
        </>
    )
}
