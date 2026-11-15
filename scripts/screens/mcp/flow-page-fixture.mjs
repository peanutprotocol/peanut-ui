import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import collections from '../collection-worker/index.mjs'
import mcp from './index.mjs'

export const version = '2026-07-28'
export const legacyVersion = '2025-11-25'
const audience = 'test-audience'
const digest = (value) => createHash('sha256').update(value).digest('hex')
export const identity = (email) => ({ access: { aud: audience, getIdentity: async () => ({ email }) } })
export const reviewer = identity('reviewer@peanut.me')

export function fixture({ listHistory } = {}) {
    const objects = new Map()
    let postWriteError = false
    let dispatches = 0
    let pendingHeads = 0
    let peakHeads = 0
    let headCount = 0
    let listCount = 0
    const env = {
        REPORTS: {
            async get(key) {
                const object = objects.get(key)
                return object ? { ...object, json: async () => JSON.parse(object.body) } : null
            },
            async list({ prefix, limit, cursor }) {
                listCount++
                const history = listHistory?.({ prefix, cursor })
                if (history) return history
                const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort()
                const offset = Number(cursor ?? 0)
                const objectsOnPage = keys.slice(offset, offset + limit).map((key) => ({ key }))
                const truncated = offset + limit < keys.length
                return { objects: objectsOnPage, truncated, ...(truncated ? { cursor: String(offset + limit) } : {}) }
            },
            async head(key) {
                headCount++
                pendingHeads++
                peakHeads = Math.max(peakHeads, pendingHeads)
                await new Promise((resolve) => setImmediate(resolve))
                pendingHeads--
                return objects.get(key) ?? null
            },
            async put(key, body, { onlyIf, customMetadata } = {}) {
                if (onlyIf?.etagDoesNotMatch === '*' && objects.has(key)) return null
                objects.set(key, { body, customMetadata })
                if (postWriteError) {
                    postWriteError = false
                    throw new Error('Response lost after write')
                }
                return objects.get(key)
            },
        },
        COLLECTION_SERVICE_TOKEN: 'test-token',
        SCREEN_LIBRARY_ACCESS_AUD: audience,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://gallery.example',
        SCREEN_LIBRARY_MCP_URL: 'https://mcp.example',
        GITHUB_REPOSITORY: 'example/example',
        GITHUB_ACTIONS_TOKEN: 'fixture',
        GITHUB_FETCH() {
            dispatches++
            throw new Error('Unexpected GitHub request')
        },
        COLLECTIONS: { fetch: (request) => collections.fetch(request, env) },
    }
    function request(path, { body, headers, context = reviewer } = {}) {
        return collections.fetch(
            new Request('https://api.example' + path, {
                method: body === undefined ? 'GET' : 'POST',
                ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
                headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
            }),
            env,
            context
        )
    }
    async function call(method, { params = {}, modern = true, authenticated = true, headers = {} } = {}) {
        const response = await mcp.fetch(
            new Request('https://mcp.example/mcp', {
                method: 'POST',
                headers: {
                    Host: 'mcp.example',
                    'Content-Type': 'application/json',
                    Accept: 'application/json, text/event-stream',
                    'MCP-Protocol-Version': modern ? version : legacyVersion,
                    ...(modern ? { 'Mcp-Method': method } : {}),
                    ...(modern && params.name ? { 'Mcp-Name': params.name } : {}),
                    ...headers,
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method,
                    params: modern
                        ? {
                              ...params,
                              _meta: {
                                  'io.modelcontextprotocol/protocolVersion': version,
                                  'io.modelcontextprotocol/clientInfo': { name: 'contract-harness', version: '1.0.0' },
                                  'io.modelcontextprotocol/clientCapabilities': {},
                              },
                          }
                        : params,
                }),
            }),
            env,
            authenticated ? reviewer : undefined
        )
        const body = await response.text()
        const contentType = response.headers.get('Content-Type')
        const envelope = contentType?.includes('text/event-stream')
            ? JSON.parse(
                  body
                      .split('\n')
                      .find((line) => line.startsWith('data: '))
                      .slice(6)
              )
            : contentType?.includes('application/json')
              ? JSON.parse(body)
              : null
        return { response, envelope }
    }
    function seed({ screenId, locale, sequence = 1, separateThumbnail = false, name }) {
        const commit = digest(locale + '-' + sequence).slice(0, 40)
        const path = ['2026-11-06', 'compare-dev', locale.toLowerCase(), commit].join('/')
        const reportKey = 'reports/' + path + '/manifest.json'
        const id = digest([screenId, locale, sequence].join('-')) + '.webp'
        const thumbnail = separateThumbnail ? digest('thumbnail-' + id) + '.webp' : id
        const report = JSON.parse(
            objects.get(reportKey)?.body ??
                JSON.stringify({
                    schema: 1,
                    type: 'capture',
                    commit,
                    locale,
                    screens: [],
                })
        )
        report.screens.push({ id: screenId, name, status: 'captured', image: id, thumbnail })
        const entries = JSON.parse(objects.get('index.json')?.body ?? '[]')
        if (!entries.some((entry) => entry.path === path))
            entries.push({ path, locale, reportType: 'capture', branch: 'dev', complete: true, sequence })
        objects.set('index.json', { body: JSON.stringify(entries) })
        objects.set('reports/' + path + '/manifest.json', { body: JSON.stringify(report) })
        objects.set('assets/' + id, { body: 'fixture-image' })
        objects.set('assets/' + thumbnail, { body: 'fixture-thumbnail' })
        return { id, screenId, locale }
    }
    async function read(id) {
        const response = await request('/v1/collections/' + id)
        assert.equal(response.status, 200)
        return (await response.json()).collection
    }
    return {
        objects,
        request,
        call,
        seed,
        read,
        manifestCount: () => [...objects.keys()].filter((key) => key.startsWith('collections/')).length,
        dropWriteResponse() {
            postWriteError = true
        },
        assetListings: () => listCount,
        assetChecks: () => ({ headCount, peakHeads }),
        counters: () => ({
            dispatches,
            uploads: [...objects.keys()].filter((key) => key.startsWith('assets/')).length,
            captures: [...objects.keys()].filter((key) => key.startsWith('collection-requests/')).length,
        }),
    }
}
