import fs from 'fs'
import path from 'path'
import { MermaidRenderer } from './MermaidRenderer'

// mono repo path — works from standalone clone (~/Developer/peanut/peanut-ui)
// and from mono submodule (~/Developer/peanut-mono/peanut-ui)
const MONO_PATHS = [
    path.resolve(process.cwd(), '../../peanut-mono/engineering/projects/kyc-2.0/flow-diagram.md'),
    path.resolve(process.cwd(), '../engineering/projects/kyc-2.0/flow-diagram.md'),
]

function findMonoFile(): string | null {
    for (const p of MONO_PATHS) {
        if (fs.existsSync(p)) return p
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
        // capture section headers as titles
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

export default function KycFlowsPage() {
    const filePath = findMonoFile()

    if (!filePath) {
        return (
            <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
                <h1>KYC Flows — File Not Found</h1>
                <p style={{ color: '#ef4444' }}>
                    Could not find <code>engineering/projects/kyc-2.0/flow-diagram.md</code> in mono repo.
                </p>
                <p>Searched paths:</p>
                <ul>
                    {MONO_PATHS.map((p) => (
                        <li key={p}><code>{p}</code></li>
                    ))}
                </ul>
            </div>
        )
    }

    const markdown = fs.readFileSync(filePath, 'utf-8')
    const diagrams = parseMermaidBlocks(markdown)

    return <MermaidRenderer diagrams={diagrams} filePath={filePath} />
}
