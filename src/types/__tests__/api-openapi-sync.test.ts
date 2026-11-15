import openapi from '../api.openapi.json'

// Pinned from the authorized local API snapshot at the release revision. Keeping
// the expectation here makes the regression portable without a sibling checkout
// or a live schema fetch.
it('documents the atomic profile-name refusal in update-user 400 responses', () => {
    const response = openapi.paths['/update-user'].post.responses['400']
    const json = response.content['application/json'] as unknown as {
        example?: { code?: string; error?: string }
        schema: { properties: { code?: { type: string; description?: string } } }
    }
    expect(json.example).toEqual({
        code: 'PROFILE_NAME_READ_ONLY',
        error: 'Your name was not saved. Names are managed through identity verification.',
    })
    // a documented string, not an enum: a union of literals made fastify answer its own validation 400s with a 500
    // (api 7e92d071f)
    expect(json.schema.properties.code).toEqual({
        type: 'string',
        description: 'PROFILE_NAME_READ_ONLY, EMAIL_VERIFICATION_REQUIRED or a validation code',
    })
})
