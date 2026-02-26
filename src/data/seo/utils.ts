// Shared extraction utilities for SEO content loaders.
// Parses structured data (FAQs, steps, troubleshooting) from markdown/MDX body text.

export interface FAQ {
    q: string
    a: string
}

/**
 * Extract FAQ items from markdown/MDX body.
 * Supports two formats:
 * 1. Markdown: ## FAQ section with ### question headings
 * 2. MDX: <FAQItem question="...">answer</FAQItem> components
 */
export function extractFaqs(body: string): FAQ[] {
    const faqs: FAQ[] = []

    // Format 1: Markdown ## FAQ section with ### headings
    const faqSection = body.match(/## (?:FAQ|Frequently Asked Questions)\s*\n([\s\S]*?)(?=\n## [^#]|$)/i)
    if (faqSection) {
        const lines = faqSection[1].split('\n')
        let currentQ = ''
        let currentA = ''

        for (const line of lines) {
            if (line.startsWith('### ')) {
                if (currentQ && currentA.trim()) faqs.push({ q: currentQ, a: currentA.trim() })
                currentQ = line.replace(/^### /, '').replace(/\*\*/g, '').trim()
                currentA = ''
            } else if (currentQ) {
                currentA += line + '\n'
            }
        }
        if (currentQ && currentA.trim()) faqs.push({ q: currentQ, a: currentA.trim() })
    }

    // Format 2: MDX <FAQItem question="...">answer</FAQItem>
    if (faqs.length === 0) {
        const faqItems = body.matchAll(/<FAQItem\s+question="([^"]+)"[^>]*>([\s\S]*?)<\/FAQItem>/g)
        for (const match of faqItems) {
            faqs.push({ q: match[1], a: match[2].trim() })
        }
    }

    return faqs
}

/**
 * Extract numbered steps from a markdown section.
 * @param body - markdown body text
 * @param headingPattern - regex pattern to match the section heading (without ## prefix)
 * @param lineParser - optional custom line parser; defaults to extracting `1. step text`
 */
export function extractSteps(
    body: string,
    headingPattern: RegExp,
    lineParser?: (line: string) => string | null
): string[] {
    const steps: string[] = []
    const section = body.match(
        new RegExp(`##?#?\\s+(?:${headingPattern.source})\\s*\\n([\\s\\S]*?)(?=\\n##?#?\\s|$)`, 'i')
    )
    if (!section) return steps

    const defaultParser = (line: string): string | null => {
        const match = line.match(/^\d+\.\s+(.+)/)
        return match ? match[1].replace(/\*\*/g, '').trim() : null
    }

    const parse = lineParser ?? defaultParser

    const lines = section[1].split('\n')
    for (const line of lines) {
        const result = parse(line)
        if (result) steps.push(result)
    }
    return steps
}

/**
 * Extract troubleshooting items from markdown body.
 * Looks for `- **issue**: fix` patterns under a ## Troubleshooting heading.
 */
export function extractTroubleshooting(body: string): Array<{ issue: string; fix: string }> {
    const items: Array<{ issue: string; fix: string }> = []
    const section = body.match(/## (?:Troubleshooting|Common Issues)\s*\n([\s\S]*?)(?=\n## [^#]|$)/i)
    if (!section) return items

    const lines = section[1].split('\n')
    for (const line of lines) {
        const match = line.match(/^[-*]\s+\*\*(.+?)\*\*[:\s]+(.+)/)
        if (match) {
            items.push({ issue: match[1], fix: match[2].trim() })
        }
    }
    return items
}
