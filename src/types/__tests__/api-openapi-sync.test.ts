import openapi from '../api.openapi.json'

// Pinned from the authorized local API snapshot at the release revision. Keeping
// the expectation here makes the regression portable without a sibling checkout
// or a live schema fetch.
it('documents the atomic profile-name refusal in update-user 400 responses', () => {
    const response = openapi.paths['/update-user'].post.responses['400']
    const json = response.content['application/json'] as unknown as {
        example?: { code?: string; error?: string }
        schema: { properties: { code?: { type: string; enum: string[] } } }
    }
    expect(json.example).toEqual({
        code: 'PROFILE_NAME_READ_ONLY',
        error: 'Your name was not saved. Names are managed through identity verification.',
    })
    expect(json.schema.properties.code).toEqual({ type: 'string', enum: ['PROFILE_NAME_READ_ONLY'] })
})
