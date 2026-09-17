export async function collectionRequest(env, path, options = {}) {
    if (!env.COLLECTIONS?.fetch || !env.COLLECTION_SERVICE_TOKEN)
        throw new Error('Collection service is not configured')
    const response = await env.COLLECTIONS.fetch(
        new Request(`https://screen-collections.internal${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${env.COLLECTION_SERVICE_TOKEN}`,
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...options.headers,
            },
        })
    )
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || `Collection service failed (${response.status})`)
    return body
}

export const textResult = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] })
