import { McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import { z } from 'zod'
import { collectionRequest, textResult } from './client.mjs'

function serverFor(env) {
    const server = new McpServer({ name: 'Peanut screen library', version: '1.0.0' })
    server.registerTool(
        'search_screens',
        {
            title: 'Search Peanut screens',
            description: 'Find captured app screens by screen name, state ID, or flow before creating a collection.',
            inputSchema: {
                query: z.string().max(200).optional(),
                locale: z.enum(['en', 'es-419', 'es-AR', 'pt-BR']).default('en'),
            },
        },
        async ({ query = '', locale }) =>
            textResult(
                await collectionRequest(
                    env,
                    `/v1/screens?locale=${encodeURIComponent(locale)}&q=${encodeURIComponent(query)}`
                )
            )
    )
    server.registerTool(
        'create_collection',
        {
            title: 'Create a screen collection',
            description:
                'Create a shareable, ordered gallery page from existing screenshots and optionally queue capture for missing states.',
            inputSchema: {
                title: z.string().min(1).max(120),
                description: z.string().max(2000).optional(),
                locales: z
                    .array(z.enum(['en', 'es-419', 'es-AR', 'pt-BR']))
                    .min(1)
                    .max(4)
                    .default(['en']),
                items: z
                    .array(
                        z.object({
                            id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
                            note: z.string().max(1000).optional(),
                        })
                    )
                    .min(1)
                    .max(200),
                captureMissing: z.boolean().default(true),
            },
        },
        async (input) =>
            textResult(
                await collectionRequest(env, '/v1/collections', {
                    method: 'POST',
                    body: JSON.stringify(input),
                })
            )
    )
    server.registerTool(
        'get_collection_status',
        {
            title: 'Get collection status',
            description: 'Read a collection and see whether any locale variants are still waiting for capture.',
            inputSchema: { id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/) },
        },
        async ({ id }) => textResult(await collectionRequest(env, `/v1/collections/${id}`))
    )
    server.registerTool(
        'capture_missing_states',
        {
            title: 'Capture missing collection states',
            description: 'Queue the focused GitHub Actions capture for variants missing from an existing collection.',
            inputSchema: { id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/) },
        },
        async ({ id }) => textResult(await collectionRequest(env, `/v1/collections/${id}/capture`, { method: 'POST' }))
    )
    return server
}

export default {
    async fetch(request, env, context) {
        const handler = createMcpHandler(() => serverFor(env), {
            route: '/mcp',
            allowedHostnames: [new URL(env.SCREEN_LIBRARY_MCP_URL).hostname],
        })
        return handler(request, env, context)
    },
}
