import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import {
    COPY_EXCEPTION_PREFIX,
    COPY_LOCALES,
    changedCopyKeys,
    copyCoverage,
    copyVerifiable,
    copyVisible,
    flattenMessages,
    hasCopyException,
    isCopyKey,
    localeMessages,
    normalizeCopy,
    parseCopyBaseline,
    shownCopyKeys,
    shownInCapture,
} from './copy-coverage.mjs'
import { COPY_RECORDER_MARKER, installCopyRecorder } from './copy-recorder.mjs'

const plain = (value) => JSON.parse(JSON.stringify(value))
const pairs = (map) => [...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

const captureOf = (screens, extra = {}) => ({
    schema: 1,
    type: 'capture',
    commit: 'a'.repeat(40),
    contentCommit: 'b'.repeat(40),
    harness: 'c'.repeat(64),
    fixtures: 'd'.repeat(64),
    locale: 'en',
    environment: 'test',
    adapter: 'v1',
    capturedAt: '2026-10-19T00:00:00Z',
    profile: 'en-393x852',
    width: 393,
    height: 852,
    copyRecording: 'recorded',
    complete: true,
    screens,
    inventory: [],
    ...extra,
})

test('module constants', () => {
    assert.deepEqual(COPY_LOCALES, ['en', 'es-419', 'es-AR', 'pt-BR'])
    assert.equal(COPY_EXCEPTION_PREFIX, 'Screen Library copy exception:')
    assert.equal(COPY_RECORDER_MARKER, '/* screen-capture-copy-v1 */')
})

test('isCopyKey accepts dot-separated segments and rejects everything else', () => {
    const valid = ['a', 'a.b', 'common.continue', 'A_b-c.9.Z', '0', 'a'.repeat(300)]
    for (const key of valid) assert.equal(isCopyKey(key), true, `expected valid: ${key.slice(0, 40)}`)
    const invalid = [
        '',
        '.',
        '.a',
        'a.',
        'a..b',
        'a b',
        'a.b c',
        ' a.b',
        'a.b ',
        'a.b\n',
        'a/b',
        'a.b!',
        'a:b',
        '\u043a\u043b\u044e\u0447.\u043e\u0434\u0438\u043d',
        'a'.repeat(301),
        null,
        undefined,
        42,
        true,
        {},
        ['a.b'],
    ]
    for (const key of invalid) assert.equal(isCopyKey(key), false, `expected invalid: ${JSON.stringify(key)}`)
})

test('localeMessages layers the locale catalogues over English', () => {
    const catalogues = {
        en: {
            common: { continue: 'Continue', cancel: 'Cancel', missing: 'Only English' },
            home: { title: 'Home' },
        },
        'es-419': {
            common: { continue: 'Continuar', cancel: null, missing: undefined },
            ar: { only419: 'Solo 419' },
        },
        'es-AR': {
            common: { continue: 'Continu\u00e1' },
            ar: { onlyAR: 'Solo AR' },
        },
        'pt-BR': {
            common: { continue: 'Continuar PT' },
            extra: { key: 'Extra' },
        },
    }
    const snapshot = structuredClone(catalogues)
    const expected = {
        en: catalogues.en,
        'es-419': {
            common: { continue: 'Continuar', cancel: 'Cancel', missing: 'Only English' },
            home: { title: 'Home' },
            ar: { only419: 'Solo 419' },
        },
        'es-AR': {
            common: { continue: 'Continu\u00e1', cancel: 'Cancel', missing: 'Only English' },
            home: { title: 'Home' },
            ar: { only419: 'Solo 419', onlyAR: 'Solo AR' },
        },
        'pt-BR': {
            common: { continue: 'Continuar PT', cancel: 'Cancel', missing: 'Only English' },
            home: { title: 'Home' },
            extra: { key: 'Extra' },
        },
    }
    const allowedReads = {
        en: ['en'],
        'es-419': ['en', 'es-419'],
        'es-AR': ['en', 'es-419', 'es-AR'],
        'pt-BR': ['en', 'pt-BR'],
    }
    for (const locale of COPY_LOCALES) {
        const reads = []
        const merged = localeMessages(locale, (name) => {
            reads.push(name)
            return catalogues[name]
        })
        assert.deepEqual(plain(merged), expected[locale], `merged catalogue for ${locale}`)
        for (const name of reads)
            assert.ok(allowedReads[locale].includes(name), `${locale} must not read the ${name} catalogue`)
        assert.deepEqual(catalogues, snapshot, `${locale} merge must not mutate the source catalogues`)
    }
})

test('localeMessages rejects unsupported locales', () => {
    for (const locale of ['fr', 'es', 'EN', 'pt', 'pt-br', '', undefined, null, 42])
        assert.throws(() => localeMessages(locale, () => ({})), undefined, `locale ${String(locale)}`)
})

test('flattenMessages maps dotted leaf paths to strings and ignores other leaves', () => {
    const flat = flattenMessages({
        a: { b: 'x', c: 3, d: null, e: true, f: undefined, g: { h: 'deep' } },
        top: 'level',
        empty: {},
    })
    assert.ok(flat instanceof Map)
    assert.deepEqual(pairs(flat), [
        ['a.b', 'x'],
        ['a.g.h', 'deep'],
        ['top', 'level'],
    ])
    assert.equal(flattenMessages({}).size, 0)
})

test('normalizeCopy applies NFKC, collapses whitespace, trims, and lowercases', () => {
    const cases = [
        ['Hello  World', 'hello world'],
        ['Hello\u00a0World', 'hello world'],
        [' \tHello\n\r\nWorld \n', 'hello world'],
        ['a\u2003b\u2009c', 'a b c'],
        ['\ufb01nd', 'find'],
        ['\uff21\uff22\uff23\uff11', 'abc1'],
        ['e\u0301', '\u00e9'],
        ['\u00c1\u00c9', '\u00e1\u00e9'],
        ['CONTINUE', 'continue'],
        ['', ''],
        ['   \n ', ''],
    ]
    for (const [input, expected] of cases) assert.equal(normalizeCopy(input), expected, JSON.stringify(input))
})

test('copyVisible requires every top-level literal fragment to appear in the corpus', () => {
    const cases = [
        ['Hello world', 'say hello world now', true],
        ['Hello world', 'say hello there', false],
        ['CONTINUE', 'continue', true],
        ['Send  money\nnow', 'send money now', true],
        ['Hello {name}, welcome back', 'hello ana, welcome back', true],
        ['Hello {name}, welcome back', 'hello ana, farewell', false],
        ['Hello {name}, welcome back', 'ana, welcome back. hello', true],
        ['Pay {amount} now', 'pay 5 now', true],
        ['Pay {amount} now', 'pay 5', false],
        ['Pay {amount} now', 'now 5 pay', true],
        ['Read <b>this</b> now', 'read this now', true],
        ['Read <b>this</b> now', 'read now', false],
        ['Read the <b>terms</b> and <link/> now', 'read the terms and privacy now', true],
        ['Read the <b>terms</b> and <link/> now', 'read the terms now', false],
        ['Click <link>here</link> to continue', 'click here to continue', true],
        ['Click <link>here</link> to continue', 'click to continue', false],
        ["Don''t stop", "don't stop", true],
        ["Don''t stop", "don''t stop", false],
        ["It''s {name}''s turn", "it's ana's turn", true],
        ["It''s {name}''s turn", "it's ana turn", false],
    ]
    for (const [template, corpus, expected] of cases)
        assert.equal(copyVisible(template, corpus), expected, `${template} in "${corpus}"`)
})

test('copyVisible ignores fragments with fewer than two letters or digits', () => {
    const cases = [
        ['{a}: {b}', 'anything', true],
        ['{a}: {b}', '', true],
        ['{amount}', 'unrelated', true],
        ['', 'unrelated', true],
        ['x {a}', 'unrelated', true],
        ['{n}%', 'unrelated', true],
        ['{n} %', 'unrelated', true],
        ['$ {amount}', 'unrelated', true],
        ['<b>{x}</b>', 'unrelated', true],
        ['{count} items \u2022 {other}', '5 items \u2022 7', true],
        ['{count} items \u2022 {other}', '5 things \u2022 7', false],
        ['{amount} USD', '5 usd', true],
        ['{amount} USD', '5 eur', false],
        ['{a} 24', 'x', false],
        ['{a} 24', 'x 24', true],
    ]
    for (const [template, corpus, expected] of cases)
        assert.equal(copyVisible(template, corpus), expected, `${JSON.stringify(template)} in "${corpus}"`)
})

test('copyVisible needs at least one visible branch for plural, select, and selectordinal arguments', () => {
    const plural = '{count, plural, one {# apple} other {# pears}}'
    const pluralWithText = 'You have {count, plural, one {# apple} other {# pears}} left'
    const exactZero = '{count, plural, =0 {No pears} one {# pear} other {# pears}}'
    const richBranches = '{n, plural, one {<b>#</b> apple} other {<b>#</b> pears}}'
    const nestedArgument = '{n, plural, one {{name} has # apple} other {{name} has # pears}}'
    const mixedBranches = '{n, plural, one {# apple} other {# pears and plums}}'
    const select = '{kind, select, cat {Meow loud} dog {Woof loud} other {Squeak loud}}'
    const ordinal = '{n, selectordinal, one {#st place} two {#nd place} few {#rd place} other {#th place}}'
    const cases = [
        [plural, '3 pears', true],
        [plural, '1 apple', true],
        [plural, '3 bananas', false],
        [pluralWithText, 'you have 3 pears left', true],
        [pluralWithText, 'you have 3 pears', false],
        [pluralWithText, 'you have 3 bananas left', false],
        [exactZero, 'no pears', true],
        [exactZero, '1 pear', true],
        [exactZero, 'nothing', false],
        [richBranches, '3 pears', true],
        [richBranches, '3 bananas', false],
        [nestedArgument, 'ana has 3 pears', true],
        [nestedArgument, 'ana has 3 bananas', false],
        [mixedBranches, '1 apple', true],
        [mixedBranches, '3 pears', false],
        [select, 'woof loud', true],
        [select, 'meow loud', true],
        [select, 'silence', false],
        [ordinal, '1st place', true],
        [ordinal, '4th place', true],
        [ordinal, 'winner', false],
    ]
    for (const [template, corpus, expected] of cases)
        assert.equal(copyVisible(template, corpus), expected, `${template} in "${corpus}"`)
})

test('copyVerifiable is true only when some literal text could be matched', () => {
    const cases = [
        ['Hello', true],
        ['Hello {name}', true],
        ['{name}, welcome', true],
        ['Read <b>this</b>', true],
        ['{count, plural, one {# apple} other {# pears}}', true],
        ['{n, plural, one {#} other {# {unit}}}', false],
        ['{kind, select, cat {Meow loud} other {{x}}}', true],
        ['{amount}', false],
        ['{a}: {b}', false],
        ['{n}%', false],
        ['<b>{x}</b>', false],
        ['{count, plural, one {#} other {#}}', false],
        ['', false],
    ]
    for (const [template, expected] of cases) assert.equal(copyVerifiable(template), expected, JSON.stringify(template))
})

test('shownCopyKeys returns sorted unique visible keys and matches loosely on case and whitespace', () => {
    const corpus = 'HOME\n\nContinue\u00a0TO   pay\tHello Ana, welcome  back\n3 PEARS'
    const cases = [
        {
            name: 'exact, uppercase, and whitespace-insensitive matches',
            resolved: [
                ['a.continue', 'Continue to pay'],
                ['a.hello', 'Hello {name}, welcome back'],
                ['a.home', 'Home'],
                ['a.plural', '{count, plural, one {# apple} other {# pears}}'],
                ['a.absent', 'Goodbye'],
            ],
            expected: ['a.continue', 'a.hello', 'a.home', 'a.plural'],
        },
        {
            name: 'sorted and unique regardless of input order and repeats',
            resolved: [
                ['z.key', 'Home'],
                ['a.key', 'Home'],
                ['z.key', 'Home'],
                ['m.key', 'Home'],
            ],
            expected: ['a.key', 'm.key', 'z.key'],
        },
        {
            name: 'a key is shown when any of its templates is visible',
            resolved: [
                ['a.key', 'Goodbye'],
                ['a.key', 'Home'],
            ],
            expected: ['a.key'],
        },
        {
            name: 'argument-only templates carry no literal text and count as visible',
            resolved: [['a.amount', '{amount}']],
            expected: ['a.amount'],
        },
        {
            name: 'a template with only some fragments visible is not shown',
            resolved: [['a.half', 'Home and Goodbye']],
            expected: [],
        },
        {
            name: 'malformed entries are skipped',
            resolved: [
                null,
                undefined,
                'abc',
                42,
                [],
                ['only.key'],
                [42, 'Home'],
                ['bad key', 'Home'],
                ['a..b', 'Home'],
                ['', 'Home'],
                ['ok.number', 42],
                ['ok.null', null],
                ['ok.object', {}],
                ['good.key', 'Home'],
            ],
            expected: ['good.key'],
        },
        { name: 'empty input', resolved: [], expected: [] },
    ]
    for (const { name, resolved, expected } of cases)
        assert.deepEqual(shownCopyKeys({ resolved, corpus }), expected, name)
})

test('shownCopyKeys throws on invalid resolved or corpus', () => {
    for (const resolved of [null, undefined, {}, 'x', 42, new Map([['a.b', 'Home']])])
        assert.throws(() => shownCopyKeys({ resolved, corpus: 'Home' }), undefined, `resolved ${String(resolved)}`)
    for (const corpus of [null, undefined, 42, ['Home'], {}])
        assert.throws(
            () => shownCopyKeys({ resolved: [['a.b', 'Home']], corpus }),
            undefined,
            `corpus ${String(corpus)}`
        )
})

test('shownInCapture maps keys to the captured screens that show them', () => {
    const capture = captureOf([
        { id: 's1', status: 'captured', copy: ['a.one', 'a.two'] },
        { id: 's2', status: 'captured', copy: ['a.two'] },
        { id: 's3', status: 'failed', copy: ['a.three'] },
        { id: 's4', status: 'skipped', copy: ['a.three'] },
        { id: 's5', status: 'captured' },
        { id: 's6', status: 'captured', copy: 'a.four' },
        { id: 's7', status: 'captured', copy: null },
    ])
    const shown = shownInCapture(capture)
    assert.ok(shown instanceof Map)
    assert.deepEqual(pairs(shown), [
        ['a.one', ['s1']],
        ['a.two', ['s1', 's2']],
    ])
    assert.equal(shownInCapture(captureOf([])).size, 0)
})

test('copyCoverage reports never-shown catalogue keys and ignores unknown shown keys', () => {
    const capture = captureOf(
        [
            { id: 's1', status: 'captured', copy: ['a.one', 'a.two'] },
            { id: 's2', status: 'captured', copy: ['a.two', 'x.extra'] },
            { id: 's3', status: 'failed', copy: ['a.three'] },
        ],
        { locale: 'es-AR', commit: 'f'.repeat(40) }
    )
    const catalogue = new Map([
        ['a.one', 'One text'],
        ['a.two', 'Two text'],
        ['a.three', 'Three text'],
        ['a.four', '{amount}'],
    ])
    const report = copyCoverage(capture, catalogue)
    assert.equal(report.schema, 1)
    assert.equal(report.commit, 'f'.repeat(40))
    assert.equal(report.locale, 'es-AR')
    assert.equal(report.complete, true)
    assert.equal(report.total, 4)
    assert.equal(report.shown, 2)
    assert.deepEqual(report.neverShown, [
        { key: 'a.four', text: '{amount}' },
        { key: 'a.three', text: 'Three text' },
    ])
    assert.deepEqual(report.shownBy['a.one'], ['s1'])
    assert.deepEqual(report.shownBy['a.two'], ['s1', 's2'])
    assert.equal(report.shownBy['x.extra'], undefined)
    assert.ok(Number.isInteger(report.unverifiable) && report.unverifiable >= 0 && report.unverifiable <= report.total)
    assert.equal(report.shown, report.total - report.neverShown.length)
})

test('copyCoverage edge catalogues', () => {
    const screens = [{ id: 's1', status: 'captured', copy: ['a.one'] }]
    const cases = [
        { name: 'everything shown', catalogue: new Map([['a.one', 'One']]), total: 1, shown: 1, neverShown: [] },
        { name: 'empty catalogue', catalogue: new Map(), total: 0, shown: 0, neverShown: [] },
        {
            name: 'nothing shown',
            catalogue: new Map([
                ['b.two', 'Two'],
                ['a.zero', 'Zero'],
            ]),
            total: 2,
            shown: 0,
            neverShown: [
                { key: 'a.zero', text: 'Zero' },
                { key: 'b.two', text: 'Two' },
            ],
        },
    ]
    for (const { name, catalogue, total, shown, neverShown } of cases) {
        const report = copyCoverage(captureOf(screens), catalogue)
        assert.equal(report.total, total, name)
        assert.equal(report.shown, shown, name)
        assert.deepEqual(report.neverShown, neverShown, name)
    }
    assert.equal(copyCoverage(captureOf(screens, { complete: false }), new Map()).complete, false)
})

test('copyCoverage refuses captures that did not record copy', () => {
    const catalogue = new Map([['a.one', 'One']])
    for (const copyRecording of ['unsupported', 'failed', 'none', '', undefined, null, true])
        assert.throws(
            () => copyCoverage(captureOf([], { copyRecording }), catalogue),
            undefined,
            `copyRecording ${String(copyRecording)}`
        )
})

test('changedCopyKeys lists new and edited keys, sorted, and never deleted ones', () => {
    const cases = [
        {
            name: 'new, edited, unchanged, and deleted',
            before: new Map([
                ['a', 'x'],
                ['b', 'y'],
                ['c', 'z'],
            ]),
            after: new Map([
                ['e', 'new2'],
                ['a', 'x'],
                ['d', 'new'],
                ['b', 'Y changed'],
            ]),
            expected: ['b', 'd', 'e'],
        },
        { name: 'identical', before: new Map([['a', 'x']]), after: new Map([['a', 'x']]), expected: [] },
        { name: 'only deletions', before: new Map([['a', 'x']]), after: new Map(), expected: [] },
        {
            name: 'empty before',
            before: new Map(),
            after: new Map([
                ['b', '2'],
                ['a', '1'],
            ]),
            expected: ['a', 'b'],
        },
    ]
    for (const { name, before, after, expected } of cases)
        assert.deepEqual(changedCopyKeys(before, after), expected, name)
})

test('parseCopyBaseline accepts the documented shape and rejects every deviation', () => {
    const parsed = parseCopyBaseline({
        schema: 1,
        keys: { 'a.b': 'decorative aria text', 'c.d': 'x'.repeat(300) },
    })
    assert.ok(parsed instanceof Map)
    assert.deepEqual(pairs(parsed), [
        ['a.b', 'decorative aria text'],
        ['c.d', 'x'.repeat(300)],
    ])
    assert.equal(parseCopyBaseline({ schema: 1, keys: {} }).size, 0)

    const invalid = [
        ['null', null],
        ['undefined', undefined],
        ['array', []],
        ['string', '{"schema":1,"keys":{}}'],
        ['number', 42],
        ['wrong schema number', { schema: 2, keys: {} }],
        ['schema as string', { schema: '1', keys: {} }],
        ['missing schema', { keys: {} }],
        ['missing keys', { schema: 1 }],
        ['array keys', { schema: 1, keys: ['a.b'] }],
        ['null keys', { schema: 1, keys: null }],
        ['empty reason', { schema: 1, keys: { 'a.b': '' } }],
        ['numeric reason', { schema: 1, keys: { 'a.b': 42 } }],
        ['null reason', { schema: 1, keys: { 'a.b': null } }],
        ['object reason', { schema: 1, keys: { 'a.b': {} } }],
        ['reason over 300 characters', { schema: 1, keys: { 'a.b': 'x'.repeat(301) } }],
        ['key with a space', { schema: 1, keys: { 'bad key': 'reason' } }],
        ['key with an empty segment', { schema: 1, keys: { 'a..b': 'reason' } }],
        ['empty key', { schema: 1, keys: { '': 'reason' } }],
        ['valid key next to an invalid one', { schema: 1, keys: { 'a.b': 'reason', 'c d': 'reason' } }],
    ]
    for (const [name, json] of invalid) assert.throws(() => parseCopyBaseline(json), undefined, name)
})

test('hasCopyException needs a line starting with the prefix and a real reason', () => {
    const prefix = COPY_EXCEPTION_PREFIX
    const accepted = [
        `${prefix} copy moved into a new component`,
        `Summary of the change\n\n${prefix} strings only render after sign-in\n\nMore text`,
        `${prefix} reviewed\r\nnext line`,
        `intro\r\n${prefix} reviewed by design`,
        `- not this one\n${prefix} the real one`,
    ]
    for (const body of accepted) assert.equal(hasCopyException(body), true, JSON.stringify(body))

    const rejected = [
        '',
        '   ',
        prefix,
        `${prefix} `,
        `${prefix}   `,
        `${prefix}\nnext line`,
        `${prefix} <reason>`,
        `${prefix} TBD`,
        `${prefix} tbd`,
        `${prefix} Tbd`,
        `${prefix} TODO`,
        `${prefix} todo`,
        `${prefix} Todo`,
        `${prefix}   TBD  `,
        ` ${prefix} indented`,
        `\t${prefix} tabbed`,
        `Note: ${prefix} inline mention`,
        `> ${prefix} quoted`,
        `<!-- ${prefix} <reason> -->`,
        'no exception here',
        'Screen Library exception: wrong prefix',
        null,
        undefined,
        42,
        true,
        {},
        [`${prefix} reason`],
    ]
    for (const body of rejected) assert.equal(hasCopyException(body), false, JSON.stringify(body))
})

const withRecorderWindow = (run) => {
    const keys = ['window', '__screenCaptureCopy', '__screenCaptureResolvedCopy']
    const had = Object.fromEntries(keys.map((key) => [key, Object.prototype.hasOwnProperty.call(globalThis, key)]))
    const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]))
    globalThis.window = globalThis
    try {
        installCopyRecorder()
        return run(globalThis.__screenCaptureCopy, globalThis.__screenCaptureResolvedCopy)
    } finally {
        for (const key of keys) {
            if (had[key]) globalThis[key] = previous[key]
            else delete globalThis[key]
        }
    }
}

const deepFreeze = (value) => {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value)) deepFreeze(child)
        Object.freeze(value)
    }
    return value
}

const recorderCatalogue = () => ({
    common: { continue: 'Continue', count: 3, flag: true, nothing: null },
    home: { title: 'Home', sub: { deep: 'Deep {x}' } },
})

test('recorder proxy records every string leaf read and nothing else', () => {
    withRecorderWindow((copy, resolved) => {
        assert.equal(typeof copy, 'function')
        assert.ok(resolved instanceof Map)
        const messages = copy(recorderCatalogue())
        assert.equal(resolved.size, 0, 'nothing is recorded before a read')

        assert.equal(messages.common.continue, 'Continue')
        assert.equal(messages.home.sub.deep, 'Deep {x}')
        assert.equal(messages.common.count, 3)
        assert.equal(messages.common.flag, true)
        assert.equal(messages.common.nothing, null)
        void messages.home

        assert.deepEqual(pairs(resolved), [
            ['common.continue', 'Continue'],
            ['home.sub.deep', 'Deep {x}'],
        ])
    })
})

test('recorder returns one proxy per catalogue object and passes non-objects through', () => {
    withRecorderWindow((copy) => {
        const catalogue = recorderCatalogue()
        const proxy = copy(catalogue)
        assert.equal(copy(catalogue), proxy)
        assert.notEqual(copy(recorderCatalogue()), proxy)
        for (const value of [undefined, null, 'text', 5, true, 0, ''])
            assert.ok(Object.is(copy(value), value), `non-object ${String(value)}`)
    })
})

test('recorder reads deeply frozen catalogues without throwing', () => {
    withRecorderWindow((copy, resolved) => {
        const frozen = deepFreeze(recorderCatalogue())
        const messages = copy(frozen)
        assert.doesNotThrow(() => messages.common)
        assert.equal(messages.common.continue, 'Continue')
        assert.equal(messages.home.sub.deep, 'Deep {x}')
        assert.equal(messages.missing, undefined)
        assert.deepEqual(pairs(resolved), [
            ['common.continue', 'Continue'],
            ['home.sub.deep', 'Deep {x}'],
        ])
    })
})

test('recorder proxies stay faithful to the catalogue they wrap', () => {
    for (const freeze of [false, true])
        withRecorderWindow((copy) => {
            const catalogue = freeze ? deepFreeze(recorderCatalogue()) : recorderCatalogue()
            const messages = copy(catalogue)
            assert.deepEqual(Object.keys(messages), ['common', 'home'], `frozen=${freeze}`)
            assert.equal('common' in messages, true)
            assert.equal('absent' in messages, false)
            assert.deepEqual(Object.keys(messages.home), ['title', 'sub'])
            assert.deepEqual(JSON.parse(JSON.stringify(messages)), recorderCatalogue())
        })
})

test('recorder function is self-contained so it can ship as a browser init script', () => {
    const context = vm.createContext({})
    vm.runInContext(`globalThis.window = globalThis;\n(${installCopyRecorder.toString()})()`, context)
    const recorded = vm.runInContext(
        `(() => {
            const messages = window.__screenCaptureCopy(Object.freeze({ a: Object.freeze({ b: 'T', c: 1 }) }))
            const read = messages.a.b
            return JSON.stringify({ read, resolved: Array.from(window.__screenCaptureResolvedCopy) })
        })()`,
        context
    )
    assert.deepEqual(JSON.parse(recorded), { read: 'T', resolved: [['a.b', 'T']] })
})
