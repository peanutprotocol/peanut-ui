import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { countMessageWords, findRegressions, isScreenRoot, measureScreens } from '../screen-wordiness-core.cjs'

describe('countMessageWords', () => {
    it('counts an argument as one rendered word', () => {
        expect(countMessageWords('Send {amount} to {name}')).toBe(4)
    })

    it('counts only the longest plural or select branch', () => {
        expect(countMessageWords('{count, plural, one {One item} other {# items, all left}} here')).toBe(5)
        expect(countMessageWords('{kind, select, bank {Bank} other {Some other method}}')).toBe(3)
    })

    it('keeps the text inside rich-text tags and drops the tags', () => {
        expect(countMessageWords('Read the <b>terms</b> first')).toBe(4)
    })
})

describe('isScreenRoot', () => {
    it('takes app pages and Screen/View/Modal/Drawer components, not marketing or primitives', () => {
        expect(isScreenRoot('app/(mobile-ui)/home/page.tsx')).toBe(true)
        expect(isScreenRoot('features/x/components/ClaimScreen.tsx')).toBe(true)
        expect(isScreenRoot('components/Kyc/InitiateKycModal.tsx')).toBe(true)
        expect(isScreenRoot('app/[locale]/(marketing)/pricing/page.tsx')).toBe(false)
        expect(isScreenRoot('app/page.tsx')).toBe(false)
        expect(isScreenRoot('components/Global/ActionModal.tsx')).toBe(false)
        expect(isScreenRoot('components/Foo/FooBody.tsx')).toBe(false)
    })
})

describe('measureScreens on a fixture tree', () => {
    let root: string
    const write = (rel: string, body: string) => {
        const file = join(root, rel)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, body)
    }

    beforeAll(() => {
        root = mkdtempSync(join(tmpdir(), 'screen-wordiness-'))
        write(
            'src/i18n/app/messages/en.json',
            JSON.stringify({
                foo: {
                    title: 'Hello there friend',
                    body: '{count, plural, one {One item left} other {# items are still left here}}',
                    callout: 'Read this carefully',
                    status: { ok: 'All good', failed: 'Something went wrong again' },
                },
                shared: { cta: 'Continue' },
            })
        )
        write(
            'src/app/(mobile-ui)/foo/page.tsx',
            `import FooBody from '@/components/Foo/FooBody'
export default function Page() {
    return <main><h1>Welcome back</h1><FooBody /></main>
}`
        )
        write(
            'src/components/Foo/FooBody.tsx',
            `import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import OtherModal from '../Other/OtherModal'
export default function FooBody({ s }: { s: string }) {
    const t = useTranslations('foo')
    return (
        <div className="flex gap-2">
            <p>{t('title')}</p>
            <p>{t('body', { count: 2 })}</p>
            <p>{t('title')}</p>
            <Callout priority="info">{t('callout')}</Callout>
            <p>{t(\`status.\${s}\`)}</p>
            <OtherModal />
        </div>
    )
}`
        )
        write(
            'src/components/Other/OtherModal.tsx',
            `import { useTranslations } from 'next-intl'
export default function OtherModal() {
    const t = useTranslations()
    return <button>{t('shared.cta')}</button>
}`
        )
        write(
            'src/components/0_Bruddle/Callout.tsx',
            `export function Callout({ children }: { children: unknown }) {
    return <div>Primitive chrome is never counted</div>
}`
        )
    })

    afterAll(() => rmSync(root, { recursive: true, force: true }))

    it('sums keys and literal text over the page and its components, once per key', () => {
        const screens = measureScreens(root)
        const page = screens.find((s: { screen: string }) => s.screen === 'app/(mobile-ui)/foo/page.tsx')
        // title 3 (used twice, counted once) + plural 6 + callout 3x2 + status 4 + literal 2
        expect(page?.words).toBe(21)
        expect(page?.callouts).toBe(1)
        expect(page?.top[0]).toEqual({ key: 'foo.body', words: 6 })
    })

    it('measures an imported modal as its own screen, not inside the page', () => {
        const screens = measureScreens(root)
        const modal = screens.find((s: { screen: string }) => s.screen === 'components/Other/OtherModal.tsx')
        expect(modal?.words).toBe(1)
        expect(screens).toHaveLength(2)
    })
})

describe('iOS copy overrides', () => {
    let root: string
    const write = (rel: string, body: string) => {
        const file = join(root, rel)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, body)
    }
    const catalog = (override: string) =>
        write(
            'src/i18n/app/messages/en.json',
            JSON.stringify({ rewards: { empty: 'No rewards yet', iosCopy: { empty: override } } })
        )
    const score = () =>
        measureScreens(root).find((s: { screen: string }) => s.screen === 'components/Rewards/RewardsScreen.tsx')

    beforeAll(() => {
        root = mkdtempSync(join(tmpdir(), 'screen-wordiness-ios-'))
        write(
            'src/components/Rewards/RewardsScreen.tsx',
            `import { useAppTranslations } from '@/i18n/app/useAppTranslations'
export function RewardsScreen() {
    const t = useAppTranslations('rewards')
    return <p>{t('empty')}</p>
}`
        )
    })

    afterAll(() => rmSync(root, { recursive: true, force: true }))

    it('scores a useAppTranslations key at the longer of the base and its iosCopy override', () => {
        catalog('No cashback')
        expect(score()?.words).toBe(3)
        catalog('No cashback yet, pay with Peanut to start earning')
        expect(score()?.words).toBe(9)
    })

    it('fails the check when only the override grows', () => {
        catalog('No cashback')
        const baseline = { budget: 5, screens: {} }
        expect(findRegressions(measureScreens(root), baseline)).toHaveLength(0)
        catalog('No cashback yet, pay with Peanut to start earning')
        expect(findRegressions(measureScreens(root), baseline).map((s: { screen: string }) => s.screen)).toEqual([
            'components/Rewards/RewardsScreen.tsx',
        ])
    })
})
