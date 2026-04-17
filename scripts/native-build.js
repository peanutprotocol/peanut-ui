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

export default function RootRedirect() {
    const router = useRouter()
    useEffect(() => {
        const token = getAuthToken()
        router.replace(token ? '/home' : '/setup')
    }, [router])
    return null
}
`,
    },
    {
        path: '(mobile-ui)/claim/page.tsx',
        // strip generateMetadata + force-dynamic, keep component render (SEO irrelevant in native)
        replacement: `import { Claim } from '@/components'

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
            fs.copyFileSync(src, dest)
            WRAPPER_FILES.push(dest) // track for cleanup
            console.log(`  ↳ Copied: ${copy.src} → ${copy.dest}`)
        }
    }
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
        // clean cache FIRST to prevent stale route trees
        console.log('🧹 Cleaning build cache...')
        if (fs.existsSync(path.join(__dirname, '..', '.next'))) {
            fs.rmSync(path.join(__dirname, '..', '.next'), { recursive: true })
        }

        copyComponentsBeforeDisable()
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
            execSync('NATIVE_BUILD=true npx next build --webpack', {
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
