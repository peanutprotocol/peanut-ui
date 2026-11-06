/**
 * Independent black-box contract. Set EXPANDED_FLOW_ADAPTER to an absolute path
 * to an ES module exporting async createHarness(). Each call returns:
 *   create({requestId, placements, locales?}) -> {id, placements} or throws
 *   read(id) -> {id, placements}
 *   seedLegacy(kind, data) -> id, where kind is 'flat' or 'flow'
 *   storageWrites() -> number (completed manifest writes)
 *   removeCapture(id, locale) -> void
 *   close() -> void
 * Each placement is {screenId, label, note}; create/read preserve its order and
 * content. The adapter maps these neutral names to the actual public contract.
 * Legacy readback normalizes to {placements:[...]}. Errors must reject.
 * Harness starts with captures capture-0000 through capture-1499 in en and es.
 * The adapter must exercise the real MCP creation and readback boundary, not a
 * duplicate implementation. This file is spec-only and has not been run.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const path = process.env.EXPANDED_FLOW_ADAPTER
if (!path) throw new Error('Set EXPANDED_FLOW_ADAPTER to the integration adapter')
const { createHarness } = await import(pathToFileURL(path).href)
const capture = (i) => `capture-${String(i).padStart(4, '0')}`
const placement = (i, extra = {}) => ({ screenId: capture(i), label: `Outcome ${i}`, note: `Note ${i}`, ...extra })
const run = (fn) => async () => {
    const h = await createHarness()
    try {
        await fn(h)
    } finally {
        await h.close()
    }
}

test(
    'large ordered page preserves distinct and repeated captures, labels and notes',
    run(async (h) => {
        const placements = Array.from({ length: 137 }, (_, i) => placement(i))
        placements.splice(5, 0, placement(2, { label: 'Repeated first', note: 'First repeat' }))
        placements.push(placement(2, { label: 'Repeated last', note: 'Last repeat' }))
        placements[80].label = 'Published catalogue label ' + 'long description '.repeat(14)
        assert.ok(placements[80].label.length >= 220)
        const created = await h.create({ requestId: 'large-ordered', placements, locales: ['en'] })
        assert.deepEqual((await h.read(created.id)).placements, placements)
    })
)

test(
    'missing capture in any requested locale causes no manifest write',
    run(async (h) => {
        const placements = Array.from({ length: 120 }, (_, i) => placement(i))
        await h.removeCapture(capture(119), 'es')
        const before = await h.storageWrites()
        await assert.rejects(h.create({ requestId: 'missing-localized', placements, locales: ['en', 'es'] }))
        assert.equal(await h.storageWrites(), before)
    })
)

test(
    'large create replay returns same page and changed payload conflicts',
    run(async (h) => {
        const placements = Array.from({ length: 125 }, (_, i) => placement(i))
        const request = { requestId: 'replay-large', placements, locales: ['en'] }
        const first = await h.create(request)
        const afterFirst = await h.storageWrites()
        const replay = await h.create(structuredClone(request))
        assert.equal(replay.id, first.id)
        assert.equal(await h.storageWrites(), afterFirst)
        assert.deepEqual((await h.read(first.id)).placements, placements)
        const changed = structuredClone(request)
        changed.placements[124].note = 'Changed payload'
        await assert.rejects(h.create(changed))
        assert.equal(await h.storageWrites(), afterFirst)
        assert.deepEqual((await h.read(first.id)).placements, placements)
    })
)

test(
    'legacy flat and flow pages coexist with a new expanded page',
    run(async (h) => {
        const flat = [placement(1), placement(2)]
        const flow = [placement(3), placement(1, { note: 'Legacy repeat' })]
        const flatId = await h.seedLegacy('flat', flat)
        const flowId = await h.seedLegacy('flow', flow)
        const expanded = Array.from({ length: 110 }, (_, i) => placement(i))
        const newPage = await h.create({ requestId: 'coexistence', placements: expanded, locales: ['en'] })
        assert.deepEqual((await h.read(flatId)).placements, flat)
        assert.deepEqual((await h.read(flowId)).placements, flow)
        assert.deepEqual((await h.read(newPage.id)).placements, expanded)
    })
)

test(
    'deterministic catalogue-scale create/read sample preserves full sequence',
    run(async (h) => {
        // Fixed seed arithmetic; 1,000 unique captures plus 200 repeated placements.
        const placements = Array.from({ length: 1000 }, (_, i) => placement((i * 613) % 1000))
        for (let i = 0; i < 200; i++) placements.push(placement((i * 97) % 1000, { note: `Repeat ${i}` }))
        const result = await h.create({ requestId: 'catalogue-scale-613-97', placements, locales: ['en'] })
        assert.deepEqual((await h.read(result.id)).placements, placements)
    })
)
