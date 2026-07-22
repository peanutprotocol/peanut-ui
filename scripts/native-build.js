#!/usr/bin/env node

/**
 * Native Build Script
 *
 * Temporarily disables server-only features (API routes, sitemap, robots, manifest)
 * and wraps client dynamic routes for static export compatibility.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const APP_DIR = path.join(__dirname, '..', 'src', 'app')

// Files/folders to temporarily disable during native build.
// the native app only needs (mobile-ui) and (setup) routes.
// everything else (marketing, blog, quests, locale pages) is web-only.
const ITEMS_TO_DISABLE = [
    { path: 'api', type: 'dir' },
    { path: 'sitemap.ts', type: 'file' },
    { path: 'robots.ts', type: 'file' },
    { path: 'manifest.ts', type: 'file' },
    { path: 'jobs/route.ts', type: 'file' },
    { path: 'm/[slug]', type: 'dir' },
    // web-only routes that conflict with static export
    { path: '[locale]', type: 'dir' }, // marketing/blog/seo pages
    { path: 'quests/[questId]', type: 'dir' }, // quest detail page (dynamicParams issues)
    { path: 'quests/explore', type: 'dir' }, // quest explore page
    { path: 'quests/page.tsx', type: 'file' }, // quest list page
    { path: 'invite', type: 'dir' }, // invite landing pages
    { path: 'exchange', type: 'dir' }, // exchange pages
    { path: 'privacy', type: 'dir' }, // legal pages
    { path: 'terms', type: 'dir' }, // legal pages
    { path: 'careers', type: 'dir' }, // careers page
    { path: 'lp', type: 'dir' }, // landing pages
    { path: 'maintenance', type: 'dir' }, // maintenance page
    { path: 'not-found.tsx', type: 'file' }, // custom 404 (not needed in native)
    { path: 'crisp-proxy', type: 'dir' }, // crisp iframe proxy (handled differently in native)
    { path: 'receipt', type: 'dir' }, // receipt pages (server component, not needed in native)
    { path: 'kyc', type: 'dir' }, // kyc success callback page (handled differently in native)
    { path: '[...recipient]/page.tsx', type: 'file' }, // root catch-all page (keep shared components)
    { path: '[...recipient]/layout.tsx', type: 'file' }, // catch-all layout
    // dynamic routes — disable page/layout files only (not whole dirs, components still needed).
    // parent pages handle query params instead in native.
    { path: 'send/[...username]/page.tsx', type: 'file' },
    { path: 'send/[...username]/layout.tsx', type: 'file' },
    { path: 'request/[...username]/page.tsx', type: 'file' },
    { path: 'request/[...username]/layout.tsx', type: 'file' },
    { path: '(mobile-ui)/add-money/[country]', type: 'dir' },
    { path: '(mobile-ui)/withdraw/[country]', type: 'dir' },
    { path: '(mobile-ui)/qr/[code]/page.tsx', type: 'file' },
    { path: '(mobile-ui)/qr/[code]/success/page.tsx', type: 'file' },
    { path: '(mobile-ui)/pay/[...username]/page.tsx', type: 'file' },
]

const MODIFIED_FILES = []
const WRAPPER_FILES = []

// files with server-only features that need to be replaced with static-export-compatible versions.
// originals are saved and restored after build — web codebase stays unchanged.
const P0_TRANSFORMS = [
    {
        path: 'page.tsx',
        // root marketing page -> redirect to /setup or /home based on auth state
        replacement: `'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthToken } from '@/utils/auth-token'
import { isDemoMode } from '@/utils/demo'

export default function RootRedirect() {
    const router = useRouter()
    useEffect(() => {
        const token = getAuthToken()
        // Demo has no JWT — without the isDemoMode() check a demo user who hits
        // the root (e.g. bounced from a web-only route) lands on /setup, whose
        // landing screen disables demo and dumps them at Log In.
        router.replace(token || isDemoMode() ? '/home' : '/setup')
    }, [router])
    return null
}
`,
    },
    {
        path: '(mobile-ui)/claim/page.tsx',
        // strip generateMetadata + force-dynamic, keep component render (SEO irrelevant in native)
        replacement: `import { Claim } from '@/components/Claim/Claim'

export default function ClaimPage() {
    return <Claim />
}
`,
    },
    {
        path: '(mobile-ui)/request/pay/page.tsx',
        replacement: `import { PayRequestLink } from '@/components/Request/Pay/Pay'

export default function RequestPay() {
    return <PayRequestLink />
}
`,
    },
    {
        path: '(mobile-ui)/points/page.tsx',
        // server redirect() -> client-side redirect
        replacement: `'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PointsRedirect() {
    const router = useRouter()
    useEffect(() => { router.replace('/rewards') }, [router])
    return null
}
`,
    },
    {
        path: '(mobile-ui)/points/invites/page.tsx',
        replacement: `'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PointsInvitesRedirect() {
    const router = useRouter()
    useEffect(() => { router.replace('/rewards/invites') }, [router])
    return null
}
`,
    },
    {
        path: '(mobile-ui)/limits/[provider]/page.tsx',
        // replace notFound() with generateStaticParams listing all valid providers.
        // providers are a known finite set — generate static HTML for each.
        replacement: `import PageContainer from '@/components/0_Bruddle/PageContainer'
import BridgeLimitsView from '@/features/limits/views/BridgeLimitsView'
import MantecaLimitsView from '@/features/limits/views/MantecaLimitsView'

export const dynamicParams = false

export function generateStaticParams() {
    return [{ provider: 'bridge' }, { provider: 'manteca' }]
}

export default async function ProviderLimitsPage({ params }: { params: Promise<{ provider: string }> }) {
    const { provider } = await params

    return (
        <PageContainer>
            {provider === 'bridge' && <BridgeLimitsView />}
            {provider === 'manteca' && <MantecaLimitsView />}
        </PageContainer>
    )
}
`,
    },
    {
        path: '(mobile-ui)/request/page.tsx',
        // strip generateMetadata, add client-side routing for ?recipient= query param.
        // when recipient is present, render DirectRequestInitialView (direct request to user).
        // otherwise, render CreateRequestLinkView (create shareable request link).
        replacement: `'use client'
import { useSearchParams } from 'next/navigation'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { CreateRequestLinkView } from '@/components/Request/link/views/Create.request.link.view'
import DirectRequestInitialView from '@/components/Request/direct-request/views/Initial.direct.request.view'

export default function RequestPage() {
    const searchParams = useSearchParams()
    const recipient = searchParams.get('recipient')

    if (recipient) {
        return (
            <PageContainer>
                <DirectRequestInitialView username={recipient} />
            </PageContainer>
        )
    }

    return (
        <PageContainer>
            <CreateRequestLinkView />
        </PageContainer>
    )
}
`,
    },
]

// copy dynamic route page components to a shared location before their directories are disabled.
// parent pages import from these copies instead of the disabled directories.
const COMPONENT_COPIES = [
    {
        src: '(mobile-ui)/add-money/[country]/bank/page.tsx',
        dest: '(mobile-ui)/add-money/_onramp-bank.tsx',
    },
    {
        src: '(mobile-ui)/add-money/[country]/[regional-method]/page.tsx',
        dest: '(mobile-ui)/add-money/_onramp-manteca.tsx',
    },
    {
        src: '(mobile-ui)/withdraw/[country]/bank/page.tsx',
        dest: '(mobile-ui)/withdraw/_withdraw-bank.tsx',
    },
    {
        src: '(mobile-ui)/qr/[code]/page.tsx',
        dest: '(mobile-ui)/qr/_claim-page.tsx',
    },
    {
        src: '(mobile-ui)/qr/[code]/success/page.tsx',
        dest: '(mobile-ui)/qr/_success-page.tsx',
    },
]

function copyComponentsBeforeDisable() {
    console.log('📋 Copying dynamic route components...')
    for (const copy of COMPONENT_COPIES) {
        const src = path.join(APP_DIR, copy.src)
        const dest = path.join(APP_DIR, copy.dest)
        if (fs.existsSync(src)) {
            // if a stub file exists, save its content so cleanup restores it (not deletes)
            if (fs.existsSync(dest)) {
                MODIFIED_FILES.push({ type: 'content', path: dest, original: fs.readFileSync(dest, 'utf-8') })
            } else {
                WRAPPER_FILES.push(dest) // no stub existed, delete on cleanup
            }
            fs.copyFileSync(src, dest)
            console.log(`  ↳ Copied: ${copy.src} → ${copy.dest}`)
        }
    }
}

// Anti-rot guard. The static export (output: 'export') cannot build server-only
// routes — route handlers and `force-dynamic` pages. Those are renamed out of the
// way via ITEMS_TO_DISABLE, but that list is hand-maintained: when web work adds a
// NEW server route not in the list, `next build` used to fail deep in the build
// with a cryptic error (the "build rot" symptom). This scans the app tree up front
// and fails LOUDLY with the exact offending paths so the fix is obvious: add them
// to ITEMS_TO_DISABLE (or give the page a generateStaticParams).
function isCoveredByDisableList(relPath) {
    const inDisableList = ITEMS_TO_DISABLE.some((item) => {
        if (item.type === 'dir') {
            return (
                relPath === item.path || relPath.startsWith(item.path + path.sep) || relPath.startsWith(item.path + '/')
            )
        }
        return relPath === item.path
    })
    if (inDisableList) return true
    // P0_TRANSFORMS replace a route's content with a static-export-safe version
    // (stripping force-dynamic / generateMetadata), so those paths are handled too
    // and must not trip the guard — e.g. (mobile-ui)/claim/page.tsx.
    return P0_TRANSFORMS.some((item) => relPath === item.path)
}

// P0_TRANSFORMS files are replaced with static-export-safe stubs before `next
// build`, so their server-only exports (generateMetadata, force-dynamic) never
// reach the export — the scan must not flag them.
function isHandledByTransform(relPath) {
    const normalized = relPath.split(path.sep).join('/')
    return P0_TRANSFORMS.some((t) => t.path === normalized)
}

function detectUncoveredServerRoutes(dir = APP_DIR, found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.includes('.disabled') || entry.name.startsWith('_')) continue
        const full = path.join(dir, entry.name)
        const rel = path.relative(APP_DIR, full)
        if (entry.isDirectory()) {
            if (isCoveredByDisableList(rel)) continue
            detectUncoveredServerRoutes(full, found)
            continue
        }
        if (isCoveredByDisableList(rel) || isHandledByTransform(rel)) continue
        if (entry.name === 'route.ts' || entry.name === 'route.js') {
            found.push({ rel, reason: 'route handler (cannot be statically exported)' })
            continue
        }
        if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
            const content = fs.readFileSync(full, 'utf-8')
            if (/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(content)) {
                found.push({ rel, reason: "export const dynamic = 'force-dynamic'" })
            }
        }
    }
    return found
}

function assertNoUncoveredServerRoutes() {
    console.log('🔎 Scanning for server-only routes not covered by the disable list...')
    const offenders = detectUncoveredServerRoutes()
    if (offenders.length === 0) {
        console.log('  ✓ none — every server-only route is handled')
        return
    }
    const lines = offenders.map((o) => `    • src/app/${o.rel}  (${o.reason})`).join('\n')
    throw new Error(
        `Native build would break: ${offenders.length} server-only route(s) are not handled for static export:\n` +
            `${lines}\n\n` +
            `Fix: add each path to ITEMS_TO_DISABLE in scripts/native-build.js (web-only routes),\n` +
            `or give dynamic pages a generateStaticParams. This guard prevents the silent "build rot"\n` +
            `where an unrelated web change breaks the native build.`
    )
}

function getDisabledPath(itemPath) {
    const dir = path.dirname(itemPath)
    const base = path.basename(itemPath)
    if (dir === '.') {
        return `_${base}.disabled`
    }
    return path.join(dir, `_${base}.disabled`)
}

function disableItems() {
    console.log('📦 Disabling server-only features...')
    for (const item of ITEMS_TO_DISABLE) {
        const src = path.join(APP_DIR, item.path)
        const dest = path.join(APP_DIR, getDisabledPath(item.path))
        if (fs.existsSync(src)) {
            fs.renameSync(src, dest)
            console.log(`  ↳ Disabled: ${item.path}`)
        }
    }
}

function restoreItems() {
    console.log('🔄 Restoring disabled items...')
    for (const item of ITEMS_TO_DISABLE) {
        const src = path.join(APP_DIR, getDisabledPath(item.path))
        const dest = path.join(APP_DIR, item.path)
        if (fs.existsSync(src)) {
            fs.renameSync(src, dest)
            console.log(`  ↳ Restored: ${item.path}`)
        }
    }
}

function findDynamicRoutes(dir, routes = [], isUnderDynamic = false) {
    const items = fs.readdirSync(dir, { withFileTypes: true })

    for (const item of items) {
        if (item.name.includes('.disabled') || item.name.startsWith('_')) continue

        const fullPath = path.join(dir, item.name)

        if (item.isDirectory()) {
            const isDynamic = item.name.includes('[') || isUnderDynamic
            findDynamicRoutes(fullPath, routes, isDynamic)
        } else if (item.name === 'page.tsx' && isUnderDynamic) {
            routes.push(fullPath)
        }
    }

    return routes
}

function transformP0Files() {
    console.log('📝 Transforming server-only files for static export...')
    for (const item of P0_TRANSFORMS) {
        const filePath = path.join(APP_DIR, item.path)
        if (fs.existsSync(filePath)) {
            const original = fs.readFileSync(filePath, 'utf-8')
            MODIFIED_FILES.push({ type: 'content', path: filePath, original })
            fs.writeFileSync(filePath, item.replacement)
            console.log(`  ↳ Transformed: ${item.path}`)
        }
    }
}

function wrapDynamicRoutes() {
    console.log('📝 Wrapping dynamic route pages for static export...')
    const dynamicRoutes = findDynamicRoutes(APP_DIR)

    for (const pagePath of dynamicRoutes) {
        const content = fs.readFileSync(pagePath, 'utf-8')

        if (content.includes('generateStaticParams')) {
            console.log(`  ↳ Skipped (already has generateStaticParams): ${path.relative(APP_DIR, pagePath)}`)
            continue
        }

        // save original content for restoration
        MODIFIED_FILES.push({ type: 'content', path: pagePath, original: content })

        // write a server component wrapper that provides generateStaticParams
        // the original client component is embedded inline via dynamic import
        const dir = path.dirname(pagePath)
        const clientFileName = '_page.client.tsx'
        const clientFilePath = path.join(dir, clientFileName)

        // copy original page content to client file
        fs.writeFileSync(clientFilePath, content)
        WRAPPER_FILES.push(clientFilePath) // track for cleanup

        // extract param name from the nearest dynamic segment directory
        const dirName = path.basename(dir)
        const segments = []
        let d = dir
        while (d !== APP_DIR) {
            const base = path.basename(d)
            if (base.includes('[')) {
                const paramName = base.replace(/[\[\]\.]/g, '')
                const isCatchAll = base.includes('...')
                segments.unshift({ paramName, isCatchAll })
            }
            d = path.dirname(d)
        }
        // build a placeholder params object for generateStaticParams
        const placeholderParams = segments
            .map((s) => (s.isCatchAll ? `"${s.paramName}": ["_"]` : `"${s.paramName}": "_"`))
            .join(', ')

        // write wrapper page — a server component that imports the client page.
        // pass only params (not searchParams) to avoid triggering the searchParams proxy.
        // cast component to any because some pages don't declare params in their types.
        const wrapperContent = `import _ClientPage from './_page.client'
const ClientPage: any = _ClientPage

export async function generateStaticParams() {
    return [{ ${placeholderParams} }]
}

export default function Page(props: any) {
    return <ClientPage params={props.params} />
}
`
        fs.writeFileSync(pagePath, wrapperContent)
        console.log(`  ↳ Wrapped: ${path.relative(APP_DIR, pagePath)}`)
    }
}

function restoreModifiedFiles() {
    if (MODIFIED_FILES.length === 0 && WRAPPER_FILES.length === 0) return

    console.log('🔄 Restoring modified files...')

    // Remove wrapper files
    for (const wrapperPath of WRAPPER_FILES) {
        if (fs.existsSync(wrapperPath)) {
            fs.unlinkSync(wrapperPath)
        }
    }

    // Restore renamed/modified files
    for (const file of MODIFIED_FILES) {
        if (file.type === 'content') {
            // Restore content
            fs.writeFileSync(file.path, file.original)
            console.log(`  ↳ Restored content: ${path.relative(APP_DIR, file.path)}`)
        } else {
            // Restore renamed file
            if (fs.existsSync(file.renamed)) {
                fs.renameSync(file.renamed, file.original)
                console.log(`  ↳ Restored: ${path.relative(APP_DIR, file.original)}`)
            }
        }
    }
}

async function main() {
    let buildSucceeded = false

    try {
        // fail fast & loud if a new server-only route slipped in (anti-rot guard)
        assertNoUncoveredServerRoutes()

        // clean cache FIRST to prevent stale route trees
        console.log('🧹 Cleaning build cache...')
        if (fs.existsSync(path.join(__dirname, '..', '.next'))) {
            fs.rmSync(path.join(__dirname, '..', '.next'), { recursive: true })
        }

        // validate required env vars for native build
        const envFile = path.join(__dirname, '..', '.env.production.local')
        if (fs.existsSync(envFile)) {
            const envContent = fs.readFileSync(envFile, 'utf-8')
            const rpIdMatch = envContent.match(/NEXT_PUBLIC_NATIVE_RP_ID=(.+)/)
            if (!rpIdMatch || !rpIdMatch[1].trim()) {
                throw new Error('NEXT_PUBLIC_NATIVE_RP_ID is not set in .env.production.local — passkeys will fail')
            }
            console.log(`✅ NEXT_PUBLIC_NATIVE_RP_ID=${rpIdMatch[1].trim()}`)

            // app id is inlined into the bundle at build time; without it the native
            // OneSignal SDK can't initialize and push notifications silently no-op.
            const appIdMatch = envContent.match(/NEXT_PUBLIC_ONESIGNAL_APP_ID=(.+)/)
            if (!appIdMatch || !appIdMatch[1].trim()) {
                console.warn('⚠️  NEXT_PUBLIC_ONESIGNAL_APP_ID is not set — native push notifications will be disabled')
            } else {
                console.log('✅ NEXT_PUBLIC_ONESIGNAL_APP_ID is set')
            }
        } else {
            console.warn('⚠️  .env.production.local not found — using default rpId (peanut.me)')
        }

        copyComponentsBeforeDisable()

        // verify component copies succeeded — blank stubs would show empty screens
        for (const copy of COMPONENT_COPIES) {
            const dest = path.join(APP_DIR, copy.dest)
            if (!fs.existsSync(dest)) {
                throw new Error(`component copy failed: ${copy.dest} does not exist`)
            }
            const content = fs.readFileSync(dest, 'utf-8')
            if (content.length < 50 || !content.includes('export')) {
                throw new Error(
                    `component copy failed: ${copy.dest} looks like a stub (${content.length} bytes) — source may be missing`
                )
            }
        }

        disableItems()
        transformP0Files()
        wrapDynamicRoutes()

        // swap next.config.js with native version (has output: 'export')
        const configDir = path.join(__dirname, '..')
        const mainConfig = path.join(configDir, 'next.config.js')
        const nativeConfig = path.join(configDir, 'next.config.native.js')
        const backupConfig = path.join(configDir, 'next.config.js.bak')

        console.log('🔄 Swapping to native config (output: export)...')
        fs.copyFileSync(mainConfig, backupConfig)
        fs.copyFileSync(nativeConfig, mainConfig)

        // verify all dynamic route pages have generateStaticParams
        console.log('🔍 Verifying wrappers...')
        const dynamicPages = findDynamicRoutes(APP_DIR)
        for (const pagePath of dynamicPages) {
            const content = fs.readFileSync(pagePath, 'utf-8')
            const hasGSP = content.includes('generateStaticParams')
            console.log(`  ${hasGSP ? '✓' : '✗'} ${path.relative(APP_DIR, pagePath)}`)
        }

        console.log('\n🏗️  Building static export...\n')
        try {
            execSync('NATIVE_BUILD=true pnpm exec next build --webpack', {
                stdio: 'inherit',
                cwd: configDir,
                env: { ...process.env, NATIVE_BUILD: 'true' },
            })
        } finally {
            // always restore original config
            console.log('🔄 Restoring original next.config.js...')
            fs.copyFileSync(backupConfig, mainConfig)
            fs.unlinkSync(backupConfig)
        }

        buildSucceeded = true
        console.log('\n✅ Native build completed successfully!')
        console.log('   Output directory: ./out')
    } catch (error) {
        console.error('\n❌ Build failed:', error.message)
        process.exitCode = 1
    } finally {
        restoreModifiedFiles()
        restoreItems()
    }

    if (buildSucceeded) {
        console.log('\n📱 Next steps:')
        console.log('   pnpm cap:sync         # Sync with native projects')
        console.log('   pnpm cap:open:android # Open in Android Studio')
    }
}

main()
