import { type SetupDocKind, type SetupDocuments } from './SetupDocsDrawer'
import { createSetupDocComponents } from './SetupDocMdx'
import { readPageContentLocalized } from '@/lib/content'
import { renderContent } from '@/lib/mdx'
import { type Locale } from '@/i18n/types'

type Frontmatter = { title: string; published?: boolean }

async function setupDocument(kind: SetupDocKind, locale: Locale) {
    const intent = kind === 'terms' || kind === 'privacy' ? 'legal' : 'help'
    const source = readPageContentLocalized<Frontmatter>(intent, kind, locale)
    if (!source || source.frontmatter.published === false) throw new Error(`Missing setup document: ${intent}/${kind}`)
    const { content } = await renderContent(source.body, locale, {
        stripLeadingH1: intent === 'legal',
        components: createSetupDocComponents(locale),
    })
    return {
        title: source.frontmatter.title.replace(/\s*\|\s*Peanut(?: Help)?$/, ''),
        content,
    }
}

/** Build from the public article sources on every app build. The legal files
 * are currently English-only; help articles use the content fallback chain. */
export async function loadSetupDocuments(): Promise<SetupDocuments> {
    const [
        terms,
        privacy,
        recoveryEn,
        recoveryEs,
        recoveryAr,
        recoveryPt,
        passkeysEn,
        passkeysEs,
        passkeysAr,
        passkeysPt,
    ] = await Promise.all([
        setupDocument('terms', 'en'),
        setupDocument('privacy', 'en'),
        setupDocument('account-recovery', 'en'),
        setupDocument('account-recovery', 'es-419'),
        setupDocument('account-recovery', 'es-ar'),
        setupDocument('account-recovery', 'pt-br'),
        setupDocument('passkeys', 'en'),
        setupDocument('passkeys', 'es-419'),
        setupDocument('passkeys', 'es-ar'),
        setupDocument('passkeys', 'pt-br'),
    ])
    return {
        terms,
        privacy,
        'account-recovery': { en: recoveryEn, 'es-419': recoveryEs, 'es-ar': recoveryAr, 'pt-br': recoveryPt },
        passkeys: { en: passkeysEn, 'es-419': passkeysEs, 'es-ar': passkeysAr, 'pt-br': passkeysPt },
    }
}
