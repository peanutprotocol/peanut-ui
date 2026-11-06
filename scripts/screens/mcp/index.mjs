import { McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import { z } from 'zod'
import { verifiedAccessIdentity } from '../access.mjs'
import { COLLECTION_LOCALES, FLOW_PAGE_REQUEST_ID } from '../collection-core.mjs'
import { collectionRequest, textResult } from './client.mjs'

function serverFor(env, actor) {
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
        'list_comparisons',
        {
            title: 'Find published revision comparisons',
            description:
                'List published before/after comparisons and their exact commits. Use a comparison path with compare_collection to view a custom collection across two revisions.',
            inputSchema: {
                locale: z.enum(['en', 'es-419', 'es-AR', 'pt-BR']).default('en'),
                beforeCommit: z
                    .string()
                    .regex(/^[a-f0-9]{40}$/)
                    .optional(),
                afterCommit: z
                    .string()
                    .regex(/^[a-f0-9]{40}$/)
                    .optional(),
            },
        },
        async ({ locale, beforeCommit, afterCommit }) => {
            const params = new URLSearchParams({ locale })
            if (beforeCommit) params.set('beforeCommit', beforeCommit)
            if (afterCommit) params.set('afterCommit', afterCommit)
            return textResult(await collectionRequest(env, `/v1/comparisons?${params}`))
        }
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
        'create_flow_page',
        {
            title: 'Create a private screen flow page',
            description:
                'Create a private shareable page with titled flows and ordered steps using published screenshots. Use search_screens to find exact state IDs. Reuse a requestId with the same input to recover an interrupted request.',
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
            inputSchema: z.strictObject({
                title: z.string().trim().min(1).max(120),
                description: z.string().max(2000).optional(),
                locales: z.array(z.enum(COLLECTION_LOCALES)).min(1).max(COLLECTION_LOCALES.length).default(['en']),
                flows: z
                    .array(
                        z.strictObject({
                            title: z.string().trim().min(1).max(120),
                            items: z
                                .array(
                                    z.strictObject({
                                        id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
                                        note: z.string().max(1000).optional(),
                                    })
                                )
                                .min(1),
                        })
                    )
                    .min(1),
                requestId: z.string().regex(FLOW_PAGE_REQUEST_ID).optional(),
            }),
            outputSchema: {
                id: z.string(),
                title: z.string(),
                description: z.string().optional(),
                locales: z.array(z.enum(COLLECTION_LOCALES)),
                url: z.url(),
            },
        },
        async (input) => {
            const page = await collectionRequest(env, '/v1/flow-pages', {
                method: 'POST',
                headers: { 'X-Screen-Library-Actor': encodeURIComponent(actor) },
                body: JSON.stringify(input),
            })
            return { ...textResult(page), structuredContent: page }
        }
    )
    server.registerTool(
        'compare_collection',
        {
            title: 'View a collection before and after',
            description:
                'Return a shareable before/after link for the selected screens in an existing collection, using a published revision comparison from list_comparisons.',
            inputSchema: {
                id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
                comparisonPath: z.string().max(200),
            },
        },
        async ({ id, comparisonPath }) =>
            textResult(
                await collectionRequest(env, `/v1/collections/${id}/compare`, {
                    method: 'POST',
                    body: JSON.stringify({ comparisonPath }),
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
        const actor = await verifiedAccessIdentity(context, env.SCREEN_LIBRARY_ACCESS_AUD)
        if (!actor) {
            return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } })
        }
        const handler = createMcpHandler(() => serverFor(env, actor), {
            route: '/mcp',
            allowedHostnames: [new URL(env.SCREEN_LIBRARY_MCP_URL).hostname],
        })
        return handler(request, env, context)
    },
}
