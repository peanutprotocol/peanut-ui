import assert from 'node:assert/strict'
import { fixture } from './flow-page-fixture.mjs'

const capture = (i) => 'capture-' + String(i).padStart(4, '0')
const publishedName = 'Published catalogue label ' + 'long description '.repeat(14)
const catalogueTitle = 'Published screen'
const productLocale = (locale) => (locale === 'es' ? 'es-419' : locale)

export async function createHarness() {
    const f = fixture()
    const assets = new Map()
    for (const locale of ['en', 'es-419']) {
        for (let i = 0; i < 1500; i++) {
            const screenId = capture(i)
            const { id } = f.seed({
                screenId,
                locale,
                name: i === 79 ? publishedName : 'Outcome ' + i,
                separateThumbnail: true,
            })
            assets.set(screenId + '/' + locale, id)
        }
    }
    function toFlows(placements) {
        const flows = []
        for (const { screenId, label, note } of placements) {
            const index = Number(screenId.slice('capture-'.length))
            const published = index === 79 ? publishedName : 'Outcome ' + index
            const title = label === published ? catalogueTitle : label
            if (flows.at(-1)?.title !== title) flows.push({ title, items: [] })
            flows.at(-1).items.push({ id: screenId, note })
        }
        return flows
    }
    async function read(id) {
        const page = await f.read(id)
        const items = new Map(page.items.map((item) => [item.id, item]))
        return {
            id: page.id,
            placements: page.flows
                ? page.flows.flatMap((flow) =>
                      flow.items.map((step) => ({
                          screenId: step.id,
                          label: flow.title === catalogueTitle ? items.get(step.id).name : flow.title,
                          note: step.note,
                      }))
                  )
                : page.items.map((item) => ({ screenId: item.id, label: item.name, note: item.note })),
        }
    }
    return {
        async create({ requestId, placements, locales = ['en'] }) {
            const { response, envelope } = await f.call('tools/call', {
                params: {
                    name: 'create_flow_page',
                    arguments: {
                        title: 'Expanded screens',
                        requestId,
                        locales: locales.map(productLocale),
                        // The catalogue supplies screen names; a differing label is a branch title.
                        flows: toFlows(placements),
                    },
                },
            })
            assert.equal(response.status, 200, JSON.stringify(envelope))
            if (envelope.error || envelope.result.isError) throw new Error(JSON.stringify(envelope))
            return read(envelope.result.structuredContent.id)
        },
        read,
        seedLegacy(kind, data) {
            const id = 'legacy-' + kind
            const items = data.map(({ screenId, label, note }, order) => {
                const image = assets.get(screenId + '/en')
                return {
                    id: screenId,
                    name: label,
                    note,
                    order,
                    flow: 'Selected screens',
                    variants: { en: { status: 'captured', image, thumbnail: image, commit: 'a'.repeat(40) } },
                }
            })
            f.objects.set('collections/' + id + '/manifest.json', {
                body: JSON.stringify({
                    schema: 1,
                    type: 'collection',
                    id,
                    title: 'Legacy page',
                    locales: ['en'],
                    items,
                    ...(kind === 'flow'
                        ? {
                              flows: data.map(({ screenId, label, note }) => ({
                                  title: label,
                                  items: [{ id: screenId, note }],
                              })),
                          }
                        : {}),
                }),
            })
            return id
        },
        storageWrites: f.manifestCount,
        removeCapture(id, locale) {
            f.objects.delete('assets/' + assets.get(id + '/' + productLocale(locale)))
        },
        close() {},
    }
}
