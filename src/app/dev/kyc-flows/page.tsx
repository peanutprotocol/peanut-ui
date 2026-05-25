import fs from 'fs'
import path from 'path'
import { MermaidRenderer } from './MermaidRenderer'
import { FALLBACK_MARKDOWN } from './fallback-data'

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

export default function KycFlowsPage() {
    // try local mono file first (instant, always fresh)
    const localPath = findLocalFile()
    if (localPath) {
        const markdown = fs.readFileSync(localPath, 'utf-8')
        const diagrams = parseMermaidBlocks(markdown)
        return <MermaidRenderer diagrams={diagrams} source={`local: ${localPath}`} />
    }

    // fallback: use hardcoded snapshot (for staging/vercel where mono isn't on disk)
    const diagrams = parseMermaidBlocks(FALLBACK_MARKDOWN)
    return <MermaidRenderer diagrams={diagrams} source="hardcoded fallback (update fallback-data.ts to refresh)" />
}
