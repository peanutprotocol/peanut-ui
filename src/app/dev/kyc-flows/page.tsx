import fs from 'fs'
import path from 'path'
import { MermaidRenderer } from './MermaidRenderer'

const GITHUB_RAW_URL =
    'https://raw.githubusercontent.com/peanutprotocol/mono/main/engineering/projects/kyc-2.0/flow-diagram.md'

// local mono repo paths — tried first for instant local dev
const MONO_PATHS = [
    path.resolve(process.cwd(), '../../peanut-mono/engineering/projects/kyc-2.0/flow-diagram.md'),
    path.resolve(process.cwd(), '../engineering/projects/kyc-2.0/flow-diagram.md'),
]

function findLocalFile(): string | null {
    for (const p of MONO_PATHS) {
        try {
            if (fs.existsSync(p)) return p
        } catch {
            // fs may not work in all environments
        }
    }
    return null
}

function parseMermaidBlocks(markdown: string): Array<{ title: string; code: string }> {
    const diagrams: Array<{ title: string; code: string }> = []
    const lines = markdown.split('\n')

    let currentTitle = ''
    let inCodeBlock = false
    let codeLines: string[] = []

    for (const line of lines) {
        if (line.startsWith('## ') || line.startsWith('### ')) {
            currentTitle = line.replace(/^#+\s*/, '').replace(/\*\*/g, '')
        }

        if (line.trim().startsWith('```mermaid')) {
            inCodeBlock = true
            codeLines = []
            continue
        }

        if (inCodeBlock && line.trim() === '```') {
            inCodeBlock = false
            if (codeLines.length > 0) {
                diagrams.push({ title: currentTitle, code: codeLines.join('\n') })
            }
            continue
        }

        if (inCodeBlock) {
            codeLines.push(line)
        }
    }

    return diagrams
}

export default async function KycFlowsPage() {
    // try local file first (instant, no network)
    const localPath = findLocalFile()
    if (localPath) {
        const markdown = fs.readFileSync(localPath, 'utf-8')
        const diagrams = parseMermaidBlocks(markdown)
        return <MermaidRenderer diagrams={diagrams} source={`local: ${localPath}`} />
    }

    // fallback: fetch from github (for staging/vercel)
    try {
        const res = await fetch(GITHUB_RAW_URL, { next: { revalidate: 300 } })
        if (!res.ok) throw new Error(`${res.status}`)
        const markdown = await res.text()
        const diagrams = parseMermaidBlocks(markdown)
        return <MermaidRenderer diagrams={diagrams} source="github: peanutprotocol/mono (main)" />
    } catch (err) {
        return (
            <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
                <h1>KYC Flows — Failed to Load</h1>
                <p style={{ color: '#ef4444' }}>
                    could not read <code>flow-diagram.md</code> from local mono repo or github.
                </p>
                <p style={{ color: '#666', fontSize: 14 }}>error: {err instanceof Error ? err.message : 'unknown'}</p>
            </div>
        )
    }
}
