import fs from 'fs'
import os from 'os'
import path from 'path'
import matter from 'gray-matter'
import { verifySplitGuides } from '../lib/verify-split-guides'

const LOCALES = ['en', 'es-419', 'pt-br'] as const
const SLUGS = ['first-split-guide', 'second-split-guide'] as const
const CTA_TEXT = { en: 'Start a split', 'es-419': 'Crear un split', 'pt-br': 'Criar um split' }

interface Diagnostic {
    check: string
    message: string
    file?: string
}

function alternates(slug: string) {
    return {
        en: `content/split-guides/${slug}/en.md`,
        'es-419': `content/split-guides/${slug}/es-419.md`,
        'pt-br': `content/split-guides/${slug}/pt-br.md`,
    }
}

function generatedFrom(slug: string, locale: (typeof LOCALES)[number]) {
    return {
        template: 'content/_system/templates/split-guide.md',
        data: [
            `content/_system/data/split-guides/${slug}.md`,
            ...(locale === 'en' ? [] : [`content/_system/data/split-guides/${slug}.${locale}.md`]),
        ],
        product: ['product/peanut-split.md'],
        workflow: 'content/_system/workflows/generate-content.md',
        context: [
            'projects/peanut-split/seo/stylebook.md',
            ...(locale === 'en' ? [] : [`projects/peanut-split/seo/localization.${locale}.md`]),
            'content/_system/context/valid-links.md',
        ],
        guidelines: [
            'content/_system/guidelines/seo.md',
            'content/_system/guidelines/components.md',
            'content/_system/guidelines/locales.md',
        ],
    }
}

function manifestEntry(slug: string, locale: (typeof LOCALES)[number]) {
    const description =
        `A practical ${locale} guide for recording group expenses, checking shared totals, and agreeing how everyone settles after a trip together`.padEnd(
            149,
            'x'
        )
    return {
        title: slug === SLUGS[0] ? 'How to Split the First Group Cost' : 'How to Split the Second Group Cost',
        description: `${description.slice(0, 149)}.`,
        slug,
        type: 'guide',
        lang: locale,
        author: 'Peanut',
        date: '2026-07-28',
        tags: ['groups', 'expenses'],
        claims: ['free-forever'],
        cast: [],
        schema_types: ['Article', 'BlogPosting'],
        canonical: `peanut.me/${locale}/split/guides/${slug}`,
        alternates: alternates(slug),
        source: {
            path: `content/_system/data/split-guides/${slug}${locale === 'en' ? '' : `.${locale}`}.md`,
            content_mode: 'compose',
            source_provenance: `peanutprotocol/peanutsplit@${'a'.repeat(40)}:apps/web/src/content/blog/${slug}/${locale}.md`,
        },
        generated_from: generatedFrom(slug, locale),
        generated_at: '2026-08-10',
    }
}

function body(slug: string, locale: (typeof LOCALES)[number]) {
    const relatedSlug = slug === SLUGS[0] ? SLUGS[1] : SLUGS[0]
    return `## A useful section

<Callout type="info">Keep one shared record.</Callout>

<CTA text="${CTA_TEXT[locale]}" subtitle="Keep the group record together." href="https://split.peanut.me/new?locale=${locale}&utm_medium=content&utm_source=split-guide&utm_campaign=${slug}&utm_content=final-cta" variant="card" />

<RelatedPages title="Related guide">
<RelatedLink href="/${locale}/split/guides/${relatedSlug}">Read the related guide</RelatedLink>
</RelatedPages>`
}

function createFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'split-guide-verifier-'))
    const contentDir = path.join(root, 'content')
    const manifestPath = path.join(root, 'generated/split-guide-manifest.json')
    const guides: Record<string, Record<string, ReturnType<typeof manifestEntry>>> = {}

    for (const slug of SLUGS) {
        guides[slug] = {}
        for (const locale of LOCALES) {
            const entry = manifestEntry(slug, locale)
            guides[slug][locale] = entry
            const { source: _source, ...frontmatter } = entry
            const file = path.join(contentDir, 'split-guides', slug, `${locale}.md`)
            fs.mkdirSync(path.dirname(file), { recursive: true })
            fs.writeFileSync(file, matter.stringify(body(slug, locale), frontmatter))
        }
    }

    fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
    fs.writeFileSync(
        manifestPath,
        JSON.stringify({
            version: 1,
            intent: 'split-guides',
            locales: LOCALES,
            allowed_product_claim_ids: ['free-forever'],
            guides,
        })
    )
    return { root, contentDir, manifestPath }
}

async function runVerifier(
    contentDir: string,
    manifestPath: string,
    validateMdx: (body: string) => Promise<void> = async () => {}
) {
    const diagnostics: Diagnostic[] = []
    const result = await verifySplitGuides({
        contentDir,
        manifestPath,
        reportError: (check, message, file) => diagnostics.push({ check, message, file }),
        validateMdx,
    })
    return { diagnostics, result }
}

describe('Split guide manifest verifier', () => {
    const roots: string[] = []

    afterEach(() => {
        for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
    })

    it('keeps an empty content family inert when no manifest exists', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'split-guide-verifier-empty-'))
        roots.push(root)

        await expect(
            runVerifier(path.join(root, 'content'), path.join(root, 'generated/manifest.json'))
        ).resolves.toEqual({
            diagnostics: [],
            result: { recordsChecked: 0 },
        })
    })

    it('rejects an existing manifest whose guides object is empty', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'split-guide-verifier-empty-manifest-'))
        roots.push(root)
        const manifestPath = path.join(root, 'generated/split-guide-manifest.json')
        fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
        fs.writeFileSync(
            manifestPath,
            JSON.stringify({
                version: 1,
                intent: 'split-guides',
                locales: LOCALES,
                allowed_product_claim_ids: ['free-forever'],
                guides: {},
            })
        )

        const { diagnostics } = await runVerifier(path.join(root, 'content'), manifestPath)
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-manifest',
                    message: expect.stringContaining('at least one guide'),
                }),
            ])
        )
    })

    it('accepts a complete exact-locale cluster that matches the manifest', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)

        await expect(runVerifier(fixture.contentDir, fixture.manifestPath)).resolves.toEqual({
            diagnostics: [],
            result: { recordsChecked: 6 },
        })
    })

    it('blocks guide files when their denormalized contract manifest is missing', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        fs.unlinkSync(fixture.manifestPath)

        const { diagnostics } = await runVerifier(fixture.contentDir, fixture.manifestPath)
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-manifest',
                    message: expect.stringContaining('require generated/split-guide-manifest.json'),
                }),
            ])
        )
    })

    it('blocks output metadata drift from the selected compose source', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        const file = path.join(fixture.contentDir, 'split-guides', SLUGS[0], 'en.md')
        const parsed = matter(fs.readFileSync(file, 'utf8'))
        parsed.data.title = 'A Drifted Title'
        fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data))

        const { diagnostics } = await runVerifier(fixture.contentDir, fixture.manifestPath)
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-manifest',
                    message: expect.stringContaining('title differs from the selected compose source'),
                }),
            ])
        )
    })

    it('blocks unexpected locales and product claims absent from the manifest registry', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        const guideDir = path.join(fixture.contentDir, 'split-guides', SLUGS[0])
        fs.copyFileSync(path.join(guideDir, 'en.md'), path.join(guideDir, 'es-ar.md'))

        const manifest = JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8'))
        manifest.allowed_product_claim_ids = ['some-other-claim']
        fs.writeFileSync(fixture.manifestPath, JSON.stringify(manifest))

        const { diagnostics } = await runVerifier(fixture.contentDir, fixture.manifestPath)
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ check: 'split-guide-locales', message: expect.stringContaining('es-ar.md') }),
                expect.objectContaining({
                    check: 'split-guide-claims',
                    message: expect.stringContaining('free-forever'),
                }),
            ])
        )
    })

    it('rejects an arbitrary repository or source path in provenance', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        const manifest = JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8'))
        manifest.guides[SLUGS[0]].en.source.source_provenance =
            `someone/else@${'a'.repeat(40)}:apps/web/src/content/blog/${SLUGS[0]}/en.md`
        fs.writeFileSync(fixture.manifestPath, JSON.stringify(manifest))

        const { diagnostics } = await runVerifier(fixture.contentDir, fixture.manifestPath)
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-provenance',
                    message: expect.stringContaining('peanutprotocol/peanutsplit@{40hex}'),
                }),
            ])
        )
    })

    it('turns an MDX compiler failure into a blocking malformed-content diagnostic', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)

        const { diagnostics } = await runVerifier(fixture.contentDir, fixture.manifestPath, async () => {
            throw new SyntaxError('fixture MDX is malformed')
        })
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-mdx',
                    message: expect.stringContaining('Malformed or unsafe MDX'),
                }),
            ])
        )
    })
})
