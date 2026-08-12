import fs from 'node:fs'
import path from 'node:path'
import { TextDecoder } from 'node:util'
import { parse, type DefaultTreeAdapterTypes } from 'parse5'
import { SaxesParser } from 'saxes'
import { isSplitContentPathname, isSupportedSplitContentPublicPath } from '@/utils/split-content-edge'

export const PRODUCTION_ORIGIN = 'https://peanut.me'
export const ROBOTS_URL = `${PRODUCTION_ORIGIN}/robots.txt`
export const ROOT_SITEMAP_URL = `${PRODUCTION_ORIGIN}/sitemap.xml`
export const SPLIT_SITEMAP_URL = `${PRODUCTION_ORIGIN}/split-sitemap.xml`
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
export const MAX_URLS_PER_REQUEST = 10_000
// The workflow cache gate hashes this exact repository-relative path.
export const DEFAULT_STATE_FILE = '.indexnow-state/urls.json'

const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'
const MAX_SITEMAP_BYTES = 10 * 1024 * 1024
const MAX_PAGE_BYTES = 5 * 1024 * 1024
const MAX_ROBOTS_BYTES = 512 * 1024
const MAX_KEY_FILE_BYTES = 512
export const MAX_STATE_BYTES = 20 * 1024 * 1024
export const MAX_STATE_URLS = 100_000
const MAX_SITEMAP_URLS = 50_000
const DEFAULT_TIMEOUT_MS = 30_000
const STATE_VERSION = 1
const INDEXNOW_KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/
const INDEXING_BLOCKED_PATTERN = /(?:^|[\s,;])(?:noindex|none)(?:$|[\s,;])/i
const CRAWLER_INDEXING_BLOCKED_PATTERN = /(?:^|[\s,;])(?:googlebot|bingbot):\s*(?:noindex|none)(?:$|[\s,;])/i

export interface IndexNowState {
    version: typeof STATE_VERSION
    urls: string[]
    writtenAt: string
    reason: 'bootstrap' | 'submission'
}

export interface IndexNowLogger {
    log(message: string): void
    error(message: string): void
}

export interface IndexNowOptions {
    fetchImpl: typeof fetch
    stateFile: string
    key?: string
    dryRun?: boolean
    bootstrap?: boolean
    full?: boolean
    robotsUrl?: string
    rootSitemapUrl?: string
    splitSitemapUrl?: string
    endpoint?: string
    timeoutMs?: number
    logger?: IndexNowLogger
    now?: () => Date
}

export interface DeployedUrls {
    rootUrls: string[]
    splitSitemapUrls: string[]
    splitUrls: string[]
    allUrls: string[]
}

export interface IndexNowRunResult {
    mode: 'gate-closed' | 'no-baseline' | 'dry-run' | 'bootstrap' | 'noop' | 'submitted'
    currentUrls: string[]
    added: string[]
    deleted: string[]
    candidates: string[]
    batches: number
}

interface SitemapFetchOptions {
    fetchImpl: typeof fetch
    url: string
    optional: boolean
    timeoutMs: number
}

interface SubmitOptions {
    fetchImpl: typeof fetch
    endpoint: string
    key: string
    urls: string[]
    timeoutMs: number
    logger: IndexNowLogger
}

class ResponseBodyLimitError extends Error {}

function assertBooleanEnvironment(name: string, value: string | undefined): boolean {
    if (value === undefined || value === '') return false
    if (value === 'true') return true
    if (value === 'false') return false
    throw new Error(`${name} must be exactly "true" or "false"`)
}

function canonicalUrlKey(value: string): string {
    return new URL(value).href
}

export function validatePublicUrl(value: unknown, label = 'URL'): string {
    if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
        throw new Error(`${label} must be a non-empty, trimmed string`)
    }
    if (/[\u0000-\u0020\u007f]/.test(value) || /%(?![0-9A-Fa-f]{2})/.test(value)) {
        throw new Error(`${label} is not RFC-3986 encoded`)
    }

    let parsed: URL
    try {
        parsed = new URL(value)
    } catch {
        throw new Error(`${label} is malformed`)
    }

    if (parsed.protocol !== 'https:' || parsed.hostname !== 'peanut.me' || parsed.port !== '') {
        throw new Error(`${label} must use the exact https://peanut.me origin`)
    }
    if (parsed.username !== '' || parsed.password !== '' || parsed.hash !== '') {
        throw new Error(`${label} must not contain credentials or a fragment`)
    }

    const serialized = parsed.href
    if (serialized !== value && !(value === PRODUCTION_ORIGIN && serialized === `${PRODUCTION_ORIGIN}/`)) {
        throw new Error(`${label} must already be canonically encoded`)
    }
    return value
}

function isSplitPathUrl(value: string): boolean {
    return isSupportedSplitContentPublicPath(new URL(value).pathname)
}

function isSplitNamespaceUrl(value: string): boolean {
    return isSplitContentPathname(new URL(value).pathname)
}

function hasQueryDelimiter(value: string): boolean {
    return new URL(value).href.includes('?')
}

export function isSplitPublicUrl(value: string): boolean {
    return isSplitPathUrl(value) && !hasQueryDelimiter(value)
}

function validateIndexNowUrl(value: unknown, label: string): string {
    const url = validatePublicUrl(value, label)
    if (hasQueryDelimiter(url)) {
        throw new Error(`${label} must not contain a query`)
    }
    return url
}

function dedupeUrls(urls: string[]): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const url of urls) {
        const key = canonicalUrlKey(url)
        if (seen.has(key)) continue
        seen.add(key)
        result.push(url)
    }
    return result
}

export function parseSitemapXml(xml: string, source: string): string[] {
    if (Buffer.byteLength(xml, 'utf8') > MAX_SITEMAP_BYTES) {
        throw new Error(`${source} exceeds the ${MAX_SITEMAP_BYTES}-byte sitemap limit`)
    }
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
        throw new Error(`${source} must not contain a DTD or entity declaration`)
    }

    let depth = 0
    let sawRoot = false
    let closedRoot = false
    let currentUrlDepth: number | null = null
    let currentUrlHasLocation = false
    let locationDepth: number | null = null
    let locationText = ''
    const urls: string[] = []
    let parserError: Error | null = null

    const parser = new SaxesParser({ xmlns: true, fileName: source })
    parser.on('doctype', () => {
        throw new Error(`${source} must not contain a DTD`)
    })
    parser.on('processinginstruction', () => {
        throw new Error(`${source} must not contain processing instructions`)
    })
    parser.on('error', (error) => {
        parserError = error
    })
    parser.on('opentag', (tag) => {
        depth += 1

        if (locationDepth !== null) {
            throw new Error(`${source} contains markup inside <loc>`)
        }

        if (depth === 1) {
            if (sawRoot || tag.local !== 'urlset' || tag.uri !== SITEMAP_NAMESPACE) {
                throw new Error(`${source} must have one sitemap <urlset> root`)
            }
            sawRoot = true
            return
        }

        if (depth === 2) {
            if (tag.local !== 'url' || tag.uri !== SITEMAP_NAMESPACE) {
                throw new Error(`${source} contains an unsupported top-level sitemap element`)
            }
            currentUrlDepth = depth
            currentUrlHasLocation = false
            return
        }

        if (
            currentUrlDepth !== null &&
            depth === currentUrlDepth + 1 &&
            tag.local === 'loc' &&
            tag.uri === SITEMAP_NAMESPACE
        ) {
            if (currentUrlHasLocation) {
                throw new Error(`${source} contains more than one <loc> in a <url>`)
            }
            locationDepth = depth
            locationText = ''
        }
    })
    parser.on('text', (text) => {
        if (locationDepth !== null) {
            locationText += text
        } else if ((depth === 0 || depth === 1) && text.trim() !== '') {
            throw new Error(`${source} contains text outside a sitemap <url>`)
        }
    })
    parser.on('cdata', (text) => {
        if (locationDepth !== null) {
            locationText += text
        } else if (text.trim() !== '') {
            throw new Error(`${source} contains unsupported CDATA`)
        }
    })
    parser.on('closetag', () => {
        if (locationDepth === depth) {
            const location = validatePublicUrl(locationText.trim(), `${source} <loc>`)
            if (urls.length >= MAX_SITEMAP_URLS) {
                throw new Error(`${source} exceeds the ${MAX_SITEMAP_URLS}-URL sitemap limit`)
            }
            urls.push(location)
            currentUrlHasLocation = true
            locationDepth = null
            locationText = ''
        }

        if (currentUrlDepth === depth) {
            if (!currentUrlHasLocation) {
                throw new Error(`${source} contains a <url> without one <loc>`)
            }
            currentUrlDepth = null
        }

        if (depth === 1) closedRoot = true
        depth -= 1
    })

    try {
        parser.write(xml.replace(/^\uFEFF/, '')).close()
    } catch {
        throw new Error(`Invalid sitemap XML from ${source}`)
    }
    if (parserError !== null) {
        throw new Error(`Invalid sitemap XML from ${source}`)
    }
    if (!sawRoot || !closedRoot || depth !== 0) {
        throw new Error(`Invalid sitemap XML from ${source}: incomplete <urlset>`)
    }
    return urls
}

function isXmlContentType(contentType: string | null): boolean {
    if (!contentType) return false
    const mediaType = contentType.split(';', 1)[0].trim().toLowerCase()
    return mediaType === 'application/xml' || mediaType === 'text/xml' || mediaType.endsWith('+xml')
}

async function fetchDirect(options: {
    fetchImpl: typeof fetch
    url: string
    accept: string
    timeoutMs: number
}): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
    try {
        const response = await options.fetchImpl(options.url, {
            method: 'GET',
            headers: { Accept: options.accept },
            redirect: 'manual',
            signal: controller.signal,
        })
        if (response.redirected || (response.url && response.url !== options.url)) {
            throw new Error(`${options.url} did not return directly from the requested URL`)
        }
        return response
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timed out for ${options.url}`)
        }
        throw new Error(`Request failed for ${options.url}`)
    } finally {
        clearTimeout(timeout)
    }
}

async function readResponseTextLimited(
    response: Response,
    maximumBytes: number,
    source: string,
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string> {
    const contentLength = response.headers.get('content-length')
    if (contentLength !== null) {
        if (!/^(?:0|[1-9]\d*)$/.test(contentLength)) {
            throw new Error(`${source} returned an invalid Content-Length`)
        }
        const declaredLength = Number(contentLength)
        if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
            throw new Error(`${source} returned an invalid Content-Length`)
        }
        if (declaredLength > maximumBytes) {
            throw new Error(`${source} exceeds the ${maximumBytes}-byte response limit`)
        }
    }

    if (!response.body) {
        return ''
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let timedOut = false
    const timeout = setTimeout(() => {
        timedOut = true
        void reader.cancel().catch(() => undefined)
    }, timeoutMs)
    let bytesRead = 0
    let text = ''
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            bytesRead += value.byteLength
            if (bytesRead > maximumBytes) {
                await reader.cancel().catch(() => undefined)
                throw new ResponseBodyLimitError(`${source} exceeds the ${maximumBytes}-byte response limit`)
            }
            text += decoder.decode(value, { stream: true })
        }
        if (timedOut) throw new Error(`Response body timed out for ${source}`)
        text += decoder.decode()
        return text
    } catch (error) {
        if (timedOut) throw new Error(`Response body timed out for ${source}`)
        if (error instanceof ResponseBodyLimitError) throw error
        const errorName =
            typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : undefined
        if (errorName === 'TypeError' || errorName === 'EncodingError') {
            throw new Error(`${source} is not valid UTF-8`)
        }
        throw new Error(`Response body read failed for ${source}`)
    } finally {
        clearTimeout(timeout)
        reader.releaseLock()
    }
}

export async function fetchSitemapUrls(options: SitemapFetchOptions): Promise<string[]> {
    const response = await fetchDirect({
        fetchImpl: options.fetchImpl,
        url: options.url,
        accept: 'application/xml, text/xml;q=0.9',
        timeoutMs: options.timeoutMs,
    })

    if (options.optional && [204, 404, 410].includes(response.status)) return []
    if (response.status !== 200) {
        throw new Error(`${options.url} returned ${response.status}; expected a direct 200 XML response`)
    }
    if (!isXmlContentType(response.headers.get('content-type'))) {
        throw new Error(`${options.url} returned a non-XML content type`)
    }

    const xml = await readResponseTextLimited(response, MAX_SITEMAP_BYTES, options.url, options.timeoutMs)
    const urls = parseSitemapXml(xml, options.url)
    if (!options.optional && urls.length === 0) {
        throw new Error(`${options.url} is required and must not be empty`)
    }
    return urls
}

export async function collectDeployedUrls(options: {
    fetchImpl: typeof fetch
    rootSitemapUrl?: string
    splitSitemapUrl?: string
    includeSplitSitemap?: boolean
    splitSitemapRequired?: boolean
    timeoutMs?: number
}): Promise<DeployedUrls> {
    const rootSitemapUrl = options.rootSitemapUrl ?? ROOT_SITEMAP_URL
    const splitSitemapUrl = options.splitSitemapUrl ?? SPLIT_SITEMAP_URL
    const includeSplitSitemap = options.includeSplitSitemap ?? true
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

    const rootUrls = await fetchSitemapUrls({
        fetchImpl: options.fetchImpl,
        url: rootSitemapUrl,
        optional: false,
        timeoutMs,
    })
    const splitSitemapUrls = includeSplitSitemap
        ? await fetchSitemapUrls({
              fetchImpl: options.fetchImpl,
              url: splitSitemapUrl,
              optional: !(options.splitSitemapRequired ?? false),
              timeoutMs,
          })
        : []

    const validatedRootUrls = rootUrls.map((url, index) =>
        validateIndexNowUrl(url, `deployed sitemap URL ${index + 1}`)
    )
    for (const url of validatedRootUrls) {
        if (isSplitNamespaceUrl(url)) {
            throw new Error(`${rootSitemapUrl} must not contain a URL from the renderer-owned Split namespace: ${url}`)
        }
    }

    const validatedSplitSitemapUrls = splitSitemapUrls.map((url, index) =>
        validatePublicUrl(url, `deployed sitemap URL ${rootUrls.length + index + 1}`)
    )
    for (const url of validatedSplitSitemapUrls) {
        if (!isSplitPathUrl(url)) {
            throw new Error(`${splitSitemapUrl} contains a URL outside the owned Split namespace: ${url}`)
        }
        if (hasQueryDelimiter(url)) {
            throw new Error(`${splitSitemapUrl} contains a Split URL with a query`)
        }
    }

    const allUrls = dedupeUrls([...validatedRootUrls, ...validatedSplitSitemapUrls])
    return {
        rootUrls: dedupeUrls(validatedRootUrls),
        splitSitemapUrls: dedupeUrls(validatedSplitSitemapUrls),
        splitUrls: allUrls.filter(isSplitPublicUrl),
        allUrls,
    }
}

export function readValidatedState(stateFile: string): IndexNowState | null {
    let descriptor: number
    try {
        descriptor = fs.openSync(stateFile, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK)
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code === 'ENOENT') return null
        if (code === 'ELOOP') {
            throw new Error(
                `Invalid IndexNow state at ${stateFile}: expected a file of at most ${MAX_STATE_BYTES} bytes`
            )
        }
        throw new Error(`Invalid IndexNow state at ${stateFile}: could not inspect the file`)
    }

    let serialized: string
    try {
        const stateStat = fs.fstatSync(descriptor)
        if (!stateStat.isFile() || stateStat.size > MAX_STATE_BYTES) {
            throw new Error(
                `Invalid IndexNow state at ${stateFile}: expected a file of at most ${MAX_STATE_BYTES} bytes`
            )
        }

        // The file can grow after fstat. Read one byte beyond the contract from
        // the same no-follow descriptor so a pathname swap or growth race can
        // neither redirect the read nor bypass the byte limit.
        const buffer = new Uint8Array(new ArrayBuffer(MAX_STATE_BYTES + 1))
        let bytesRead = 0
        while (bytesRead < buffer.byteLength) {
            const count = fs.readSync(descriptor, buffer, bytesRead, buffer.byteLength - bytesRead, null)
            if (count === 0) break
            bytesRead += count
        }
        if (bytesRead > MAX_STATE_BYTES) {
            throw new Error(
                `Invalid IndexNow state at ${stateFile}: expected a file of at most ${MAX_STATE_BYTES} bytes`
            )
        }
        serialized = new TextDecoder().decode(buffer.subarray(0, bytesRead))
    } finally {
        fs.closeSync(descriptor)
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(serialized)
    } catch {
        throw new Error(`Invalid IndexNow state at ${stateFile}: could not parse JSON`)
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(`Invalid IndexNow state at ${stateFile}: expected an object`)
    }
    const candidate = parsed as Partial<IndexNowState>
    const stateKeys = Object.keys(candidate).sort()
    if (JSON.stringify(stateKeys) !== JSON.stringify(['reason', 'urls', 'version', 'writtenAt'])) {
        throw new Error(`Invalid IndexNow state at ${stateFile}: unexpected fields`)
    }
    if (candidate.version !== STATE_VERSION || !Array.isArray(candidate.urls)) {
        throw new Error(`Invalid IndexNow state at ${stateFile}: unsupported version or URL list`)
    }
    if (candidate.urls.length > MAX_STATE_URLS) {
        throw new Error(`Invalid IndexNow state at ${stateFile}: exceeds the ${MAX_STATE_URLS}-URL limit`)
    }
    if (candidate.reason !== 'bootstrap' && candidate.reason !== 'submission') {
        throw new Error(`Invalid IndexNow state at ${stateFile}: invalid reason`)
    }
    if (typeof candidate.writtenAt !== 'string' || Number.isNaN(Date.parse(candidate.writtenAt))) {
        throw new Error(`Invalid IndexNow state at ${stateFile}: invalid timestamp`)
    }

    let urls: string[]
    try {
        urls = candidate.urls.map((url, index) => validateIndexNowUrl(url, `state URL ${index + 1}`))
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Invalid IndexNow state at ${stateFile}: ${message}`)
    }
    if (dedupeUrls(urls).length !== urls.length) {
        throw new Error(`Invalid IndexNow state at ${stateFile}: duplicate URLs`)
    }
    return {
        version: STATE_VERSION,
        urls,
        writtenAt: candidate.writtenAt,
        reason: candidate.reason,
    }
}

export function writeStateAtomic(
    stateFile: string,
    urls: string[],
    reason: IndexNowState['reason'],
    now: () => Date = () => new Date()
): void {
    if (urls.length > MAX_STATE_URLS) {
        throw new Error(`Refusing to write more than ${MAX_STATE_URLS} URLs to IndexNow state`)
    }
    const validatedUrls = urls.map((url, index) => validateIndexNowUrl(url, `state URL ${index + 1}`))
    if (dedupeUrls(validatedUrls).length !== validatedUrls.length) {
        throw new Error('Refusing to write duplicate URLs to IndexNow state')
    }

    const state: IndexNowState = {
        version: STATE_VERSION,
        urls: validatedUrls,
        writtenAt: now().toISOString(),
        reason,
    }
    const serializedState = `${JSON.stringify(state)}\n`
    if (Buffer.byteLength(serializedState, 'utf8') > MAX_STATE_BYTES) {
        throw new Error(`Refusing to write more than ${MAX_STATE_BYTES} bytes to IndexNow state`)
    }
    const directory = path.dirname(stateFile)
    const temporaryFile = path.join(directory, `.${path.basename(stateFile)}.${process.pid}.${Date.now()}.tmp`)
    fs.mkdirSync(directory, { recursive: true })
    const directoryStat = fs.lstatSync(directory)
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
        throw new Error(`Refusing to write IndexNow state through a non-directory or symbolic link: ${directory}`)
    }
    try {
        fs.writeFileSync(temporaryFile, serializedState, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
        fs.renameSync(temporaryFile, stateFile)
    } finally {
        if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile)
    }
}

export function hasNoindexDirective(html: string, xRobotsTag: string | null): boolean {
    if (xRobotsTag && xRobotsTagBlocksIndexing(xRobotsTag)) return true
    const parsed = parseIndexabilityHtml(html)
    return parsed === null || parsed.noindex
}

interface ParsedIndexabilityHtml {
    canonicals: string[]
    noindex: boolean
}

function blocksIndexing(value: string): boolean {
    return INDEXING_BLOCKED_PATTERN.test(value)
}

function xRobotsTagBlocksIndexing(value: string): boolean {
    return blocksIndexing(value) || CRAWLER_INDEXING_BLOCKED_PATTERN.test(value)
}

function documentBlocksIndexing(root: DefaultTreeAdapterTypes.Element): boolean {
    const pending: DefaultTreeAdapterTypes.Element[] = [root]

    while (pending.length > 0) {
        const node = pending.pop()!
        if (node.tagName === 'meta') {
            const attributes = new Map(node.attrs.map(({ name, value }) => [name, value]))
            const name = attributes.get('name')?.toLowerCase()
            const httpEquiv = attributes.get('http-equiv')?.toLowerCase()
            const content = attributes.get('content')
            if (!content) continue
            if (httpEquiv === 'x-robots-tag' && xRobotsTagBlocksIndexing(content)) return true
            if ((name === 'robots' || name === 'bingbot' || name === 'googlebot') && blocksIndexing(content))
                return true
        }

        // parse5 stores template descendants on `content`, not `childNodes`;
        // intentionally do not traverse inert template content.
        for (const child of node.childNodes) {
            if ('tagName' in child) pending.push(child)
        }
    }

    return false
}

function parseIndexabilityHtml(html: string): ParsedIndexabilityHtml | null {
    let malformed = false
    const document = parse(html, {
        sourceCodeLocationInfo: true,
        onParseError: () => {
            malformed = true
        },
    })
    if (malformed) return null

    const htmlElement = document.childNodes.find(
        (node): node is DefaultTreeAdapterTypes.Element => 'tagName' in node && node.tagName === 'html'
    )
    const head = htmlElement?.childNodes.find(
        (node): node is DefaultTreeAdapterTypes.Element => 'tagName' in node && node.tagName === 'head'
    )
    if (!htmlElement || !head?.sourceCodeLocation?.startTag || !head.sourceCodeLocation.endTag) return null

    const canonicals: string[] = []
    for (const node of head.childNodes) {
        if (!('tagName' in node)) continue
        const attributes = new Map(node.attrs.map(({ name, value }) => [name, value]))
        if (node.tagName === 'link') {
            const relations = attributes.get('rel')?.toLowerCase().split(/\s+/) ?? []
            if (relations.includes('canonical')) canonicals.push(attributes.get('href') ?? '')
        }
    }
    return { canonicals, noindex: documentBlocksIndexing(htmlElement) }
}

export async function assertSplitPageIndexable(options: {
    fetchImpl: typeof fetch
    url: string
    timeoutMs?: number
}): Promise<void> {
    const url = validatePublicUrl(options.url, 'Split page URL')
    if (!isSplitPublicUrl(url)) throw new Error(`Not a public Split URL: ${url}`)

    const response = await fetchDirect({
        fetchImpl: options.fetchImpl,
        url,
        accept: 'text/html',
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    })
    if (response.status !== 200) {
        throw new Error(`${url} returned ${response.status}; an indexable Split page must return direct 200`)
    }
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
    if (contentType !== 'text/html') {
        throw new Error(`${url} returned a non-HTML content type`)
    }

    const html = await readResponseTextLimited(response, MAX_PAGE_BYTES, url, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    const xRobotsTag = response.headers.get('x-robots-tag')
    if (xRobotsTag && xRobotsTagBlocksIndexing(xRobotsTag)) {
        throw new Error(`${url} is still noindex; refusing IndexNow submission`)
    }
    const indexability = parseIndexabilityHtml(html)
    if (indexability === null) {
        throw new Error(`${url} must contain exactly one absolute self-canonical link`)
    }
    if (indexability.noindex) {
        throw new Error(`${url} is still noindex; refusing IndexNow submission`)
    }
    if (indexability.canonicals.length !== 1 || indexability.canonicals[0] !== url) {
        throw new Error(`${url} must contain exactly one absolute self-canonical link`)
    }
}

function isPlainTextContentType(contentType: string | null): boolean {
    return contentType?.split(';', 1)[0].trim().toLowerCase() === 'text/plain'
}

function sitemapDirectives(robots: string): Set<string> {
    const directives = new Set<string>()
    for (const line of robots.replace(/^\uFEFF/, '').split(/\r?\n/)) {
        const withoutComment = line.split('#', 1)[0].trim()
        const match = withoutComment.match(/^sitemap\s*:\s*(\S+)\s*$/i)
        if (match) directives.add(match[1])
    }
    return directives
}

// A non-200 or non-text/plain robots.txt advertises nothing, so every gate
// derived from this set stays closed. An unreadable one (network error,
// oversize, invalid UTF-8) throws instead and fails the whole run.
async function deployedRobotsSitemapDirectives(options: {
    fetchImpl: typeof fetch
    robotsUrl: string
    timeoutMs: number
}): Promise<Set<string>> {
    const response = await fetchDirect({
        fetchImpl: options.fetchImpl,
        url: options.robotsUrl,
        accept: 'text/plain',
        timeoutMs: options.timeoutMs,
    })
    if (response.status !== 200 || !isPlainTextContentType(response.headers.get('content-type'))) return new Set()

    const robots = await readResponseTextLimited(response, MAX_ROBOTS_BYTES, options.robotsUrl, options.timeoutMs)
    return sitemapDirectives(robots)
}

function calculateDelta(current: string[], previous: string[]): { added: string[]; deleted: string[] } {
    const previousKeys = new Set(previous.map(canonicalUrlKey))
    const currentKeys = new Set(current.map(canonicalUrlKey))
    return {
        added: current.filter((url) => !previousKeys.has(canonicalUrlKey(url))),
        deleted: previous.filter((url) => !currentKeys.has(canonicalUrlKey(url))),
    }
}

function validateKey(key: string | undefined): string {
    if (!key || !INDEXNOW_KEY_PATTERN.test(key)) {
        throw new Error('INDEXNOW_KEY must contain 8-128 letters, numbers, or dashes')
    }
    return key
}

async function assertIndexNowKeyPublished(options: {
    fetchImpl: typeof fetch
    key: string
    timeoutMs: number
}): Promise<void> {
    const url = `${PRODUCTION_ORIGIN}/${options.key}.txt`
    const response = await fetchDirect({
        fetchImpl: options.fetchImpl,
        url,
        accept: 'text/plain',
        timeoutMs: options.timeoutMs,
    })
    if (response.status !== 200 || !isPlainTextContentType(response.headers.get('content-type'))) {
        throw new Error(`${url} must return direct 200 text/plain before IndexNow submission`)
    }
    const publishedKey = await readResponseTextLimited(response, MAX_KEY_FILE_BYTES, url, options.timeoutMs)
    if (publishedKey !== options.key) {
        throw new Error(`${url} must contain exactly the configured IndexNow key`)
    }
}

export async function submitIndexNowBatches(options: SubmitOptions): Promise<number> {
    const key = validateKey(options.key)
    if (options.urls.length > MAX_STATE_URLS) {
        throw new Error(`Refusing to submit more than ${MAX_STATE_URLS} IndexNow URLs`)
    }
    const urls = options.urls.map((url, index) => validateIndexNowUrl(url, `submission URL ${index + 1}`))
    if (dedupeUrls(urls).length !== urls.length) {
        throw new Error('Refusing to submit duplicate IndexNow URLs')
    }
    let failures = 0
    let batches = 0

    for (let start = 0; start < urls.length; start += MAX_URLS_PER_REQUEST) {
        const batch = urls.slice(start, start + MAX_URLS_PER_REQUEST)
        batches += 1
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
        try {
            const response = await options.fetchImpl(options.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({
                    host: 'peanut.me',
                    key,
                    keyLocation: `${PRODUCTION_ORIGIN}/${key}.txt`,
                    urlList: batch,
                }),
                redirect: 'manual',
                signal: controller.signal,
            })
            if (response.body) await response.body.cancel().catch(() => undefined)
            if (response.status !== 200 && response.status !== 202) {
                options.logger.error(`IndexNow batch ${batches} failed with ${response.status}`)
                failures += 1
            } else {
                options.logger.log(`IndexNow batch ${batches} accepted (${response.status}, ${batch.length} URLs)`)
            }
        } catch (error) {
            const suffix = error instanceof Error && error.name === 'AbortError' ? ' timed out' : ' failed'
            options.logger.error(`IndexNow batch ${batches} request${suffix}`)
            failures += 1
        } finally {
            clearTimeout(timeout)
        }
    }

    if (failures > 0) throw new Error(`${failures} IndexNow batch(es) failed; state was not advanced`)
    return batches
}

export async function runIndexNow(options: IndexNowOptions): Promise<IndexNowRunResult> {
    const logger = options.logger ?? console
    const dryRun = options.dryRun ?? false
    const bootstrap = options.bootstrap ?? false
    const full = options.full ?? false
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const robotsUrl = options.robotsUrl ?? ROBOTS_URL
    const rootSitemapUrl = options.rootSitemapUrl ?? ROOT_SITEMAP_URL
    const splitSitemapUrl = options.splitSitemapUrl ?? SPLIT_SITEMAP_URL

    if (bootstrap && (dryRun || full)) {
        throw new Error('INDEXNOW_BOOTSTRAP cannot be combined with dry-run or full mode')
    }

    if (bootstrap) {
        const deployed = await collectDeployedUrls({
            fetchImpl: options.fetchImpl,
            rootSitemapUrl,
            splitSitemapUrl,
            timeoutMs,
        })
        const state = readValidatedState(options.stateFile)
        if (state) {
            throw new Error('Bootstrap requires missing IndexNow state; refusing to replace an existing baseline')
        }
        if (deployed.splitUrls.length > 0) {
            throw new Error('Bootstrap is allowed only while the deployed Split sitemap is empty')
        }
        writeStateAtomic(options.stateFile, deployed.allUrls, 'bootstrap', options.now)
        logger.log(`Bootstrapped IndexNow state with ${deployed.allUrls.length} deployed root URLs; submitted none.`)
        return {
            mode: 'bootstrap',
            currentUrls: deployed.allUrls,
            added: [],
            deleted: [],
            candidates: [],
            batches: 0,
        }
    }

    // Deployed robots.txt owns both gates independently: advertising the root
    // sitemap opens the run at all, and advertising the Split sitemap is the
    // Split release signal that puts Split URLs in scope. While Split is dark
    // the run still submits root URLs and never reaches a Split URL.
    const advertisedSitemaps = await deployedRobotsSitemapDirectives({
        fetchImpl: options.fetchImpl,
        robotsUrl,
        timeoutMs,
    })
    if (!advertisedSitemaps.has(rootSitemapUrl)) {
        logger.log('IndexNow release gate is closed in deployed robots.txt; submitted none and changed no state.')
        return {
            mode: 'gate-closed',
            currentUrls: [],
            added: [],
            deleted: [],
            candidates: [],
            batches: 0,
        }
    }
    const splitReleased = advertisedSitemaps.has(splitSitemapUrl)

    const deployed = await collectDeployedUrls({
        fetchImpl: options.fetchImpl,
        rootSitemapUrl,
        splitSitemapUrl,
        includeSplitSitemap: splitReleased,
        splitSitemapRequired: splitReleased,
        timeoutMs,
    })

    // A previously accepted Split page can later regress to redirect/noindex.
    // Gate every currently deployed Split URL before reading state or making a
    // live submission. Deleted Split URLs remain eligible for notification.
    for (const url of deployed.splitUrls) {
        await assertSplitPageIndexable({ fetchImpl: options.fetchImpl, url, timeoutMs })
    }

    const key = validateKey(options.key)
    await assertIndexNowKeyPublished({ fetchImpl: options.fetchImpl, key, timeoutMs })

    const state = readValidatedState(options.stateFile)
    if (!state && !full) {
        logger.log(
            'No validated IndexNow baseline exists; dispatch this workflow with bootstrap=true and dry_run=false to record one. Submitted none and changed no state.'
        )
        return {
            mode: 'no-baseline',
            currentUrls: deployed.allUrls,
            added: [],
            deleted: [],
            candidates: [],
            batches: 0,
        }
    }

    const previousUrls = state?.urls ?? []
    // Split URLs recorded by an earlier release stay in the baseline while the
    // Split sitemap is unadvertised: they are neither resubmitted nor reported
    // as deletions, so no Split URL can reach the API before robots.txt says so.
    const currentUrls = splitReleased
        ? deployed.allUrls
        : dedupeUrls([...deployed.allUrls, ...previousUrls.filter(isSplitNamespaceUrl)])
    const delta = calculateDelta(currentUrls, previousUrls)
    // Full mode still owes a deletion notification for everything the baseline
    // holds and the deployed sitemaps no longer list; the state write drops it.
    const candidates = full ? dedupeUrls([...deployed.allUrls, ...delta.deleted]) : [...delta.added, ...delta.deleted]

    if (dryRun) {
        logger.log(
            `IndexNow dry-run: ${delta.added.length} added, ${delta.deleted.length} deleted, ${candidates.length} candidate URL(s); submitted none.`
        )
        return {
            mode: 'dry-run',
            currentUrls,
            added: delta.added,
            deleted: delta.deleted,
            candidates,
            batches: 0,
        }
    }

    if (candidates.length === 0) {
        logger.log('IndexNow delta is empty; submitted none and changed no state.')
        return {
            mode: 'noop',
            currentUrls,
            added: delta.added,
            deleted: delta.deleted,
            candidates,
            batches: 0,
        }
    }

    const batches = await submitIndexNowBatches({
        fetchImpl: options.fetchImpl,
        endpoint: options.endpoint ?? INDEXNOW_ENDPOINT,
        key,
        urls: candidates,
        timeoutMs,
        logger,
    })
    writeStateAtomic(options.stateFile, currentUrls, 'submission', options.now)
    logger.log(`IndexNow submission complete: ${candidates.length} URL(s) in ${batches} batch(es).`)
    return {
        mode: 'submitted',
        currentUrls,
        added: delta.added,
        deleted: delta.deleted,
        candidates,
        batches,
    }
}

export function resolveIndexNowEnvironmentOptions(
    environment: Record<string, string | undefined>,
    cliArguments: readonly string[]
): Pick<IndexNowOptions, 'stateFile' | 'key' | 'dryRun' | 'bootstrap' | 'full'> {
    if (cliArguments.length > 0) {
        throw new Error('CLI URL arguments are disabled; deployed sitemaps are the only URL source')
    }
    return {
        stateFile: environment.INDEXNOW_STATE_FILE || path.join(process.cwd(), DEFAULT_STATE_FILE),
        key: environment.INDEXNOW_KEY,
        dryRun: assertBooleanEnvironment('INDEXNOW_DRY_RUN', environment.INDEXNOW_DRY_RUN),
        bootstrap: assertBooleanEnvironment('INDEXNOW_BOOTSTRAP', environment.INDEXNOW_BOOTSTRAP),
        full: assertBooleanEnvironment('INDEXNOW_FULL', environment.INDEXNOW_FULL),
    }
}

export async function runIndexNowFromEnvironment(
    environment: Record<string, string | undefined> = process.env,
    fetchImpl: typeof fetch = fetch,
    logger: IndexNowLogger = console
): Promise<IndexNowRunResult> {
    return runIndexNow({
        fetchImpl,
        logger,
        ...resolveIndexNowEnvironmentOptions(environment, process.argv.slice(2)),
    })
}
