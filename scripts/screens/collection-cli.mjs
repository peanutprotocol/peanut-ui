#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { collectionId, composeCollection, normalizeCollectionSpec } from './collection-core.mjs'
import { verifyAsset } from './core.mjs'

function argumentsFrom(argv) {
    const options = { reports: {} }
    for (const value of argv) {
        if (value.startsWith('--spec=')) options.spec = value.slice(7)
        else if (value.startsWith('--out=')) options.out = value.slice(6)
        else if (value.startsWith('--id=')) options.id = value.slice(5)
        else if (value.startsWith('--api=')) options.api = value.slice(6)
        else if (value.startsWith('--report=')) {
            const pair = value.slice(9)
            const separator = pair.indexOf(':')
            if (separator < 1) throw new Error('Use --report=<locale>:<manifest-or-directory>')
            options.reports[pair.slice(0, separator)] = pair.slice(separator + 1)
        } else throw new Error(`Unknown option: ${value}`)
    }
    if (!options.spec) throw new Error('Use --spec=<collection.json>')
    return options
}

function reportInput(value) {
    const path = resolve(value)
    const name = basename(path)
    const manifestPath =
        name === 'manifest.json' || name === 'capture.json'
            ? path
            : existsSync(join(path, 'manifest.json'))
              ? join(path, 'manifest.json')
              : join(path, 'capture.json')
    return {
        report: JSON.parse(readFileSync(manifestPath, 'utf8')),
        assets: join(dirname(manifestPath), 'assets'),
    }
}

export async function createLocalCollection({ specPath, outDir, id, reportArgs }) {
    const spec = normalizeCollectionSpec(JSON.parse(readFileSync(resolve(specPath), 'utf8')))
    const loaded = Object.fromEntries(spec.locales.map((locale) => [locale, reportInput(reportArgs[locale] ?? '')]))
    const collection = composeCollection({
        id: id || collectionId(spec.title),
        spec,
        reports: Object.fromEntries(Object.entries(loaded).map(([locale, value]) => [locale, value.report])),
        createdAt: new Date(),
        createdBy: 'local-cli',
    })
    const output = resolve(outDir)
    mkdirSync(join(output, 'assets'), { recursive: true })
    for (const item of collection.items)
        for (const [locale, variant] of Object.entries(item.variants)) {
            if (variant.status !== 'captured') continue
            for (const name of new Set([variant.image, variant.thumbnail])) {
                const bytes = verifyAsset(loaded[locale].assets, name)
                writeFileSync(join(output, 'assets', name), bytes)
            }
        }
    writeFileSync(join(output, 'manifest.json'), JSON.stringify(collection, null, 2))
    writeFileSync(
        join(output, 'report.js'),
        `window.SCREEN_REPORT=${JSON.stringify(collection)
            .replace(/</g, '\\u003c')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029')};`
    )
    const html = readFileSync('public/screen-library/index.html', 'utf8')
        .replaceAll('/screen-library/', './')
        .replace(
            '<script defer src="./viewer.js">',
            '<script src="./report.js"></script><script defer src="./viewer.js">'
        )
    writeFileSync(join(output, 'index.html'), html)
    for (const name of ['viewer.js', 'viewer.css']) copyFileSync(`public/screen-library/${name}`, join(output, name))
    return collection
}

export async function createHostedCollection(api, spec, { env = process.env, fetchImpl = fetch } = {}) {
    const origin = new URL(api)
    if (origin.protocol !== 'https:') throw new Error('Collection API must use HTTPS')
    const clientId = env.CLOUDFLARE_ACCESS_CLIENT_ID
    const clientSecret = env.CLOUDFLARE_ACCESS_CLIENT_SECRET
    if (!clientId || !clientSecret)
        throw new Error('CLOUDFLARE_ACCESS_CLIENT_ID and CLOUDFLARE_ACCESS_CLIENT_SECRET are required')
    const response = await fetchImpl(new URL('/v1/collections', origin), {
        method: 'POST',
        headers: {
            'CF-Access-Client-Id': clientId,
            'CF-Access-Client-Secret': clientSecret,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(spec),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || `Collection API failed (${response.status})`)
    return body
}

export async function main(argv = process.argv.slice(2)) {
    const options = argumentsFrom(argv)
    const spec = normalizeCollectionSpec(JSON.parse(readFileSync(resolve(options.spec), 'utf8')))
    if (options.api) {
        const result = await createHostedCollection(options.api, spec)
        console.log(result.url)
        return result
    }
    if (!options.out) throw new Error('Use --out=<directory> for a local collection')
    const collection = await createLocalCollection({
        specPath: options.spec,
        outDir: options.out,
        id: options.id,
        reportArgs: options.reports,
    })
    console.log(pathToFileURL(join(resolve(options.out), 'index.html')).href)
    return collection
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) await main()
