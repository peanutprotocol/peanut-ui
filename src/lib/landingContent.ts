// Server-side reader for landing-page singleton content.
// Source: mono/content/landing/{lang}.md → peanut-content mirror → submodule.
//
// Uses fs.readFileSync via readSingletonContent — must run in a server
// component or route handler, never inside a 'use client' file.

import { readSingletonContentLocalized } from '@/lib/content'
import type { Locale } from '@/i18n/types'

interface LandingFrontmatter {
    hero?: {
        primary_cta?: { label?: string; href?: string; subtext?: string }
    }
    marquee?: string[]
    faqs?: {
        questions?: Array<{ id: string; question: string; answer: string }>
    }
}

/** One word of the product marquee. `id` is the English word at the same
 *  position in landing/en.md, so link targets survive translation. */
export interface MarqueeChip {
    id: string
    label: string
}

export interface LandingContent {
    heroConfig: {
        primaryCta: { label: string; href: string; subtext?: string }
    }
    faqData: {
        questions: Array<{ id: string; question: string; answer: string }>
    }
    marqueeMessages: MarqueeChip[]
}

// Fallback used if the singleton MD is missing (e.g. submodule hasn't synced).
// Mirrors the original landingPageData.ts shape — empty content is safer than
// crashing the landing page.
const DEFAULTS: LandingContent = {
    heroConfig: { primaryCta: { label: 'Sign up', href: '/setup' } },
    faqData: { questions: [] },
    marqueeMessages: [],
}

function marqueeWords(fm: LandingFrontmatter | undefined): string[] {
    return (fm?.marquee ?? []).filter((m): m is string => typeof m === 'string')
}

// Every locale lists the marquee in the same order as en, so the English word
// at a position is that chip's id. A list whose length differs from en's is
// out of step; its words become their own ids (unlinked unless spelled the same).
function marqueeChips(words: string[], locale: Locale): MarqueeChip[] {
    const ids =
        locale === 'en'
            ? words
            : marqueeWords(readSingletonContentLocalized<LandingFrontmatter>('landing', 'en')?.frontmatter)
    return words.map((label, i) => ({ id: ids.length === words.length ? ids[i] : label, label }))
}

export function getLandingContent(locale: Locale = 'en'): LandingContent {
    const content = readSingletonContentLocalized<LandingFrontmatter>('landing', locale)
    if (!content) return DEFAULTS

    const fm = content.frontmatter
    return {
        heroConfig: {
            primaryCta: {
                label: fm.hero?.primary_cta?.label ?? DEFAULTS.heroConfig.primaryCta.label,
                href: fm.hero?.primary_cta?.href ?? DEFAULTS.heroConfig.primaryCta.href,
                subtext: fm.hero?.primary_cta?.subtext,
            },
        },
        faqData: {
            // Authored frontmatter — drop malformed entries so a null/partial
            // item can't crash the .map() in the landing page.
            questions: (fm.faqs?.questions ?? []).filter(
                (q): q is { id: string; question: string; answer: string } =>
                    q != null &&
                    typeof q.id === 'string' &&
                    typeof q.question === 'string' &&
                    typeof q.answer === 'string'
            ),
        },
        marqueeMessages: marqueeChips(marqueeWords(fm), locale),
    }
}
