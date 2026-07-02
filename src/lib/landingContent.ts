// Server-side reader for landing-page singleton content.
// Source: mono/content/landing/{lang}.md → peanut-content mirror → submodule.
//
// Uses fs.readFileSync via readSingletonContent — must run in a server
// component or route handler, never inside a 'use client' file.

import { readSingletonContentLocalized } from '@/lib/content'
import {
    SUPPORTED_RAILS_FAQ_ANSWER,
    SUPPORTED_RAILS_FAQ_ID,
    SUPPORTED_RAILS_FAQ_QUESTION,
} from '@/constants/faq.consts'
import type { Locale } from '@/i18n/types'

interface LandingFrontmatter {
    hero?: {
        primary_cta?: { label?: string; href?: string; subtext?: string }
    }
    marquee?: string[]
    faqs?: {
        heading?: string
        questions?: Array<{ id: string; question: string; answer: string }>
        marquee?: { visible: boolean; message: string }
    }
}

export interface LandingContent {
    heroConfig: {
        primaryCta: { label: string; href: string; subtext?: string }
    }
    faqData: {
        heading: string
        questions: Array<{ id: string; question: string; answer: string }>
        marquee: { visible: boolean; message: string }
    }
    marqueeMessages: string[]
}

// Fallback used if the singleton MD is missing (e.g. submodule hasn't synced).
// Mirrors the original landingPageData.ts shape — empty content is safer than
// crashing the landing page.
const DEFAULTS: LandingContent = {
    heroConfig: { primaryCta: { label: 'SIGN UP', href: '/setup' } },
    faqData: { heading: 'FAQ.', questions: [], marquee: { visible: false, message: 'Peanut' } },
    marqueeMessages: [],
}

// Code-defined FAQ item advertising supported networks/tokens/bank rails.
// Lives in code (not the content MD) because its facts derive from
// rhino.consts — the same constants the add-money flow renders — so the
// public answer can't drift from what the app actually supports.
// LandingPageClient swaps in the rich chip UI by this id.
const SUPPORTED_RAILS_QUESTION = {
    id: SUPPORTED_RAILS_FAQ_ID,
    question: SUPPORTED_RAILS_FAQ_QUESTION,
    answer: SUPPORTED_RAILS_FAQ_ANSWER,
}

// Insert before the last content question, which is the "My question is not
// here → help center" catch-all by convention.
function withSupportedRails(questions: LandingContent['faqData']['questions']) {
    if (questions.length === 0) return [SUPPORTED_RAILS_QUESTION]
    return [...questions.slice(0, -1), SUPPORTED_RAILS_QUESTION, ...questions.slice(-1)]
}

export function getLandingContent(locale: Locale = 'en'): LandingContent {
    const content = readSingletonContentLocalized<LandingFrontmatter>('landing', locale)
    if (!content)
        return {
            ...DEFAULTS,
            faqData: { ...DEFAULTS.faqData, questions: withSupportedRails(DEFAULTS.faqData.questions) },
        }

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
            heading: fm.faqs?.heading ?? DEFAULTS.faqData.heading,
            // Authored frontmatter — drop malformed entries so a null/partial
            // item can't crash the .map() in the landing page.
            questions: withSupportedRails(
                (fm.faqs?.questions ?? []).filter(
                    (q): q is { id: string; question: string; answer: string } =>
                        q != null &&
                        typeof q.id === 'string' &&
                        typeof q.question === 'string' &&
                        typeof q.answer === 'string'
                )
            ),
            marquee:
                fm.faqs?.marquee && typeof fm.faqs.marquee.message === 'string'
                    ? fm.faqs.marquee
                    : DEFAULTS.faqData.marquee,
        },
        marqueeMessages: (fm.marquee ?? DEFAULTS.marqueeMessages).filter((m): m is string => typeof m === 'string'),
    }
}
