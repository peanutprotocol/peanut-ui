import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { materializeCatalogue, validateCapture } from './core.mjs'

const screens = JSON.parse(
    execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '-e',
            "const { SCREENS } = require('./src/dev/screens/catalogue.ts'); console.log(JSON.stringify(SCREENS))",
        ],
        { encoding: 'utf8' }
    )
)

const expectedStates = [
    {
        id: '82-f-choice-card-needs-review',
        requiredContext: ['card_needs_review'],
    },
    {
        id: '89-f-withdraw-review-insufficient',
        requiredContext: ['insufficientBalance'],
    },
    {
        id: '90-f-withdraw-review-processing',
        requiredContext: ['insufficientBalance', 'processing'],
    },
    {
        id: '91-f-withdraw-review-spent',
        requiredContext: ['insufficientBalance', 'spent'],
    },
]

test('state catalogue exposes the four distinct stable scenario IDs', () => {
    for (const { id } of expectedStates) {
        const matches = screens.filter((screen) => screen.id === id)
        assert.equal(matches.length, 1, `${id} must occur exactly once`)
    }
})

test('state scenarios use captureable component routes with source and state context', () => {
    for (const { id, requiredContext } of expectedStates) {
        const screen = screens.find((candidate) => candidate.id === id)
        assert.ok(screen, `${id} is missing`)
        assert.equal(typeof screen.route, 'string', `${id} needs a route`)
        assert.ok(screen.route.startsWith('/'), `${id} route must be repository-relative application path`)
        assert.equal(typeof screen.expectSelector, 'string', `${id} needs a capture selector`)
        assert.ok(screen.expectSelector.length > 0, `${id} capture selector must not be blank`)

        const context = JSON.stringify(screen)
        assert.match(context, /(?:component|source|path)/i, `${id} must identify its component source/path`)
        for (const value of requiredContext)
            assert.ok(context.includes(value), `${id} must preserve ${value} in its catalogue context`)
    }
})

test('state scenarios materialize as capture entries for every supported locale', () => {
    for (const locale of ['en', 'es-419', 'es-AR', 'pt-BR']) {
        const manifest = validateCapture({
            schema: 1,
            type: 'capture',
            commit: 'a'.repeat(40),
            contentCommit: 'b'.repeat(40),
            harness: 'c'.repeat(64),
            fixtures: 'd'.repeat(64),
            environment: 'state-coverage-test',
            adapter: 'v1',
            capturedAt: '2026-10-13T00:00:00Z',
            locale,
            profile: `${locale}-393x852`,
            width: 393,
            height: 852,
            screens: materializeCatalogue(screens, []),
            inventory: [],
        })

        for (const { id } of expectedStates)
            assert.equal(
                manifest.screens.filter((screen) => screen.id === id).length,
                1,
                `${id} must be captureable for ${locale}`
            )
    }
})
