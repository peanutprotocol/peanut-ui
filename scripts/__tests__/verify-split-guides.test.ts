import { createHash } from 'crypto'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import matter from 'gray-matter'
import { verifySplitGuides } from '../lib/verify-split-guides'

const LOCALES = ['en', 'es-419', 'pt-br'] as const
const SLUGS = ['first-split-guide', 'second-split-guide'] as const
const CTA_TEXT = { en: 'Start a split', 'es-419': 'Crear un split', 'pt-br': 'Criar um split' }
const VERIFIER_PAYLOAD_PREFIX = '__SPLIT_GUIDE_VERIFIER_PAYLOAD__'

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
        ],
        guidelines: [
            'content/_system/guidelines/seo.md',
            'content/_system/guidelines/components.md',
            'content/_system/guidelines/locales.md',
            'content/_system/guidelines/intent-taxonomy.md',
        ],
    }
}

function manifestEntry(slug: string, locale: (typeof LOCALES)[number], sourceSha256: string) {
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
        schema_types: ['BlogPosting'],
        canonical: `peanut.me/${locale}/split/guides/${slug}`,
        alternates: alternates(slug),
        source: {
            path: `content/_system/data/split-guides/${slug}${locale === 'en' ? '' : `.${locale}`}.md`,
            content_mode: 'compose',
            source_provenance: `peanutprotocol/peanutsplit@${'a'.repeat(40)}:apps/web/src/content/blog/${slug}/${locale}.md`,
            sha256: sourceSha256,
        },
        generated_from: generatedFrom(slug, locale),
        generated_at: '2026-08-10',
    }
}

function composeSource(slug: string, locale: (typeof LOCALES)[number]) {
    const entry = manifestEntry(slug, locale, '0'.repeat(64))
    const sourceFrontmatter = {
        title: entry.title,
        description: entry.description,
        slug: entry.slug,
        type: entry.type,
        lang: entry.lang,
        author: entry.author,
        date: entry.date,
        tags: entry.tags,
        schema_types: entry.schema_types,
        content_mode: entry.source.content_mode,
        claims: entry.claims,
        cast: entry.cast,
        source_provenance: entry.source.source_provenance,
        adapted_at: entry.generated_at,
    }
    return matter.stringify(`## Source brief\n\nWrite the exact ${locale} guide for ${slug}.\n`, sourceFrontmatter)
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
            const sourceContent = composeSource(slug, locale)
            const sourceFile = path.join(
                root,
                `content/_system/data/split-guides/${slug}${locale === 'en' ? '' : `.${locale}`}.md`
            )
            fs.mkdirSync(path.dirname(sourceFile), { recursive: true })
            fs.writeFileSync(sourceFile, sourceContent)

            const sourceSha256 = createHash('sha256').update(sourceContent, 'utf8').digest('hex')
            const entry = manifestEntry(slug, locale, sourceSha256)
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

interface RunVerifierOptions {
    sourceRoot?: string
    validateMdx?: (body: string) => Promise<void>
}

async function runVerifier(contentDir: string, manifestPath: string, options: RunVerifierOptions = {}) {
    const diagnostics: Diagnostic[] = []
    const result = await verifySplitGuides({
        contentDir,
        manifestPath,
        reportError: (check, message, file) => diagnostics.push({ check, message, file }),
        ...(options.sourceRoot ? { sourceRoot: options.sourceRoot } : {}),
        ...(options.validateMdx ? { validateMdx: options.validateMdx } : {}),
    })
    return { diagnostics, result }
}

const skipMdxCompile = async () => {}

async function runFastVerifier(contentDir: string, manifestPath: string, options: RunVerifierOptions = {}) {
    return runVerifier(contentDir, manifestPath, {
        ...options,
        validateMdx: options.validateMdx ?? skipMdxCompile,
    })
}

function runDefaultCompilerVerifier(contentDir: string, manifestPath: string) {
    const verifierPath = path.resolve(__dirname, '../lib/verify-split-guides.ts')
    const program = `
        const imported = await import(${JSON.stringify(verifierPath)});
        const verifySplitGuides = imported.verifySplitGuides ?? imported.default.verifySplitGuides;
        const diagnostics = [];
        const result = await verifySplitGuides({
            contentDir: ${JSON.stringify(contentDir)},
            manifestPath: ${JSON.stringify(manifestPath)},
            reportError: (check, message, file) => diagnostics.push({ check, message, file }),
        });
        process.stdout.write(${JSON.stringify(VERIFIER_PAYLOAD_PREFIX)} + JSON.stringify({ diagnostics, result }) + '\\n');
    `
    const completed = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', program], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 15_000,
    })
    if ((completed.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT') {
        throw new Error('Default compiler subprocess timed out after 15 seconds')
    }
    if (completed.error) throw completed.error
    if (completed.status !== 0) {
        throw new Error(`Default compiler subprocess failed: ${completed.stderr || completed.stdout}`)
    }
    const payload = completed.stdout.split(/\r?\n/).findLast((line) => line.startsWith(VERIFIER_PAYLOAD_PREFIX))
    if (!payload) throw new Error(`Default compiler subprocess returned no verifier payload: ${completed.stdout}`)
    return JSON.parse(payload.slice(VERIFIER_PAYLOAD_PREFIX.length)) as {
        diagnostics: Diagnostic[]
        result: { recordsChecked: number }
    }
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
            runFastVerifier(path.join(root, 'content'), path.join(root, 'generated/manifest.json'))
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

        const { diagnostics } = await runFastVerifier(path.join(root, 'content'), manifestPath)
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

        await expect(runFastVerifier(fixture.contentDir, fixture.manifestPath)).resolves.toEqual({
            diagnostics: [],
            result: { recordsChecked: 6 },
        })
    })

    it('keeps mirrored UI verification independent from an unavailable compose-source checkout', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        fs.rmSync(path.join(fixture.root, 'content/_system'), { recursive: true })

        await expect(runFastVerifier(fixture.contentDir, fixture.manifestPath)).resolves.toEqual({
            diagnostics: [],
            result: { recordsChecked: 6 },
        })
    })

    it('verifies exact compose-source bytes and metadata when a source root is supplied', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)

        await expect(
            runFastVerifier(fixture.contentDir, fixture.manifestPath, { sourceRoot: fixture.root })
        ).resolves.toEqual({
            diagnostics: [],
            result: { recordsChecked: 6 },
        })
    })

    it('blocks compose-source body drift from its manifest digest', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        const sourceFile = path.join(fixture.root, `content/_system/data/split-guides/${SLUGS[0]}.md`)
        const source = fs.readFileSync(sourceFile, 'utf8')
        fs.writeFileSync(sourceFile, source.replace('Write the exact en guide', 'Rewrite the exact en guide'))

        const { diagnostics } = await runFastVerifier(fixture.contentDir, fixture.manifestPath, {
            sourceRoot: fixture.root,
        })
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-source',
                    message: expect.stringContaining('digest differs from manifest'),
                    file: sourceFile,
                }),
            ])
        )
    })

    it('blocks compose-source frontmatter drift from both its digest and selected metadata', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        const sourceFile = path.join(fixture.root, `content/_system/data/split-guides/${SLUGS[0]}.md`)
        const source = fs.readFileSync(sourceFile, 'utf8')
        fs.writeFileSync(sourceFile, source.replace('author: Peanut', 'author: Someone Else'))

        const { diagnostics } = await runFastVerifier(fixture.contentDir, fixture.manifestPath, {
            sourceRoot: fixture.root,
        })
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-source',
                    message: expect.stringContaining('digest differs from manifest'),
                    file: sourceFile,
                }),
                expect.objectContaining({
                    check: 'split-guide-source',
                    message: expect.stringContaining('author differs between the selected compose source and manifest'),
                    file: sourceFile,
                }),
            ])
        )
    })

    it('blocks guide files when their denormalized contract manifest is missing', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        fs.unlinkSync(fixture.manifestPath)

        const { diagnostics } = await runFastVerifier(fixture.contentDir, fixture.manifestPath)
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-manifest',
                    message: expect.stringContaining('require generated/split-guide-manifest.json'),
                }),
            ])
        )
    })

    it('blocks output metadata drift from the mirrored manifest contract', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        const file = path.join(fixture.contentDir, 'split-guides', SLUGS[0], 'en.md')
        const content = fs.readFileSync(file, 'utf8')
        fs.writeFileSync(file, content.replace('title: How to Split the First Group Cost', 'title: A Drifted Title'))

        const { diagnostics } = await runFastVerifier(fixture.contentDir, fixture.manifestPath)
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-manifest',
                    message: expect.stringContaining('title differs from the manifest contract'),
                }),
            ])
        )
    })

    it('rejects a redundant Article schema beside BlogPosting', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        const file = path.join(fixture.contentDir, 'split-guides', SLUGS[0], 'en.md')
        const parsed = matter(fs.readFileSync(file, 'utf8'))
        fs.writeFileSync(
            file,
            matter.stringify(parsed.content, { ...parsed.data, schema_types: ['Article', 'BlogPosting'] })
        )

        const manifest = JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8'))
        manifest.guides[SLUGS[0]].en.schema_types = ['Article', 'BlogPosting']
        fs.writeFileSync(fixture.manifestPath, JSON.stringify(manifest))

        const { diagnostics } = await runFastVerifier(fixture.contentDir, fixture.manifestPath)
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-manifest',
                    message: expect.stringContaining('exactly [BlogPosting]'),
                }),
                expect.objectContaining({
                    check: 'split-guide-contract',
                    message: expect.stringContaining('exactly [BlogPosting]'),
                }),
            ])
        )
    })

    it('reports the effective title limit that includes the route-owned suffix', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        const file = path.join(fixture.contentDir, 'split-guides', SLUGS[0], 'en.md')
        const content = fs.readFileSync(file, 'utf8')
        fs.writeFileSync(file, content.replace('title: How to Split the First Group Cost', `title: ${'x'.repeat(52)}`))

        const { diagnostics } = await runFastVerifier(fixture.contentDir, fixture.manifestPath)
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-contract',
                    message: expect.stringContaining('raw 52, effective 61'),
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

        const { diagnostics } = await runFastVerifier(fixture.contentDir, fixture.manifestPath)
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

        const { diagnostics } = await runFastVerifier(fixture.contentDir, fixture.manifestPath)
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-provenance',
                    message: expect.stringContaining('peanutprotocol/peanutsplit@{40hex}'),
                }),
            ])
        )
    })

    it('requires a deterministic source digest in the mirrored manifest', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        const manifest = JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8'))
        delete manifest.guides[SLUGS[0]].en.source.sha256
        fs.writeFileSync(fixture.manifestPath, JSON.stringify(manifest))

        const { diagnostics } = await runFastVerifier(fixture.contentDir, fixture.manifestPath)
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-provenance',
                    message: expect.stringContaining('source.sha256 must be a lowercase SHA-256 digest'),
                }),
            ])
        )
    })

    it('turns an MDX compiler failure into a blocking malformed-content diagnostic', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)

        const { diagnostics } = await runFastVerifier(fixture.contentDir, fixture.manifestPath, {
            validateMdx: async () => {
                throw new SyntaxError('fixture MDX is malformed')
            },
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

    it('uses the default runtime compiler to reject a nested H1', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        const file = path.join(fixture.contentDir, 'split-guides', SLUGS[0], 'en.md')
        const parsed = matter(fs.readFileSync(file, 'utf8'))
        parsed.content = `> # A nested H1\n\n${parsed.content.trimStart()}`
        fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data))

        const { diagnostics } = runDefaultCompilerVerifier(fixture.contentDir, fixture.manifestPath)
        expect(diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    check: 'split-guide-mdx',
                    message: expect.stringContaining(
                        'Malformed or unsafe MDX: Split guide body must not contain an H1'
                    ),
                }),
            ])
        )
    })

    it('allows forbidden page syntax when the default runtime compiler sees it inside fenced code', async () => {
        const fixture = createFixture()
        roots.push(fixture.root)
        const file = path.join(fixture.contentDir, 'split-guides', SLUGS[0], 'en.md')
        const parsed = matter(fs.readFileSync(file, 'utf8'))
        const fencedExample = [
            '```mdx',
            '# Example H1',
            'Example setext H1',
            '=================',
            '<h1>Example HTML</h1>',
            '<Hero title="Example component" />',
            '```',
        ].join('\n')
        parsed.content = `${fencedExample}\n\n${parsed.content.trimStart()}`
        fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data))

        expect(runDefaultCompilerVerifier(fixture.contentDir, fixture.manifestPath)).toEqual({
            diagnostics: [],
            result: { recordsChecked: 6 },
        })
    })
})
