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

// Files/folders to temporarily disable during native build
const ITEMS_TO_DISABLE = [
    { path: 'api', type: 'dir' },
    { path: 'sitemap.ts', type: 'file' },
    { path: 'robots.ts', type: 'file' },
    { path: 'manifest.ts', type: 'file' },
    { path: 'jobs/route.ts', type: 'file' },
]

const MODIFIED_FILES = []
const WRAPPER_FILES = []

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

function findDynamicRoutes(dir, routes = []) {
    const items = fs.readdirSync(dir, { withFileTypes: true })

    for (const item of items) {
        if (item.name.includes('.disabled') || item.name.startsWith('_')) continue

        const fullPath = path.join(dir, item.name)

        if (item.isDirectory()) {
            if (item.name.includes('[')) {
                const pagePath = path.join(fullPath, 'page.tsx')
                if (fs.existsSync(pagePath)) {
                    routes.push(pagePath)
                }
            }
            findDynamicRoutes(fullPath, routes)
        }
    }

    return routes
}

function wrapClientComponents() {
    console.log('📝 Wrapping client components for static export...')
    const dynamicRoutes = findDynamicRoutes(APP_DIR)

    for (const pagePath of dynamicRoutes) {
        const content = fs.readFileSync(pagePath, 'utf-8')

        // Skip if already has generateStaticParams (server component)
        if (content.includes('generateStaticParams')) {
            console.log(`  ↳ Skipped (already has generateStaticParams): ${path.relative(APP_DIR, pagePath)}`)
            continue
        }

        // Check if it's a client component
        const isClientComponent =
            content.trimStart().startsWith("'use client'") || content.trimStart().startsWith('"use client"')

        if (isClientComponent) {
            // For client components, we need to create a wrapper
            const dir = path.dirname(pagePath)

            // Find the default export name
            const exportMatch = content.match(/export\s+default\s+(?:function\s+)?(\w+)/)
            if (!exportMatch) {
                console.log(`  ↳ Skipped (no default export found): ${path.relative(APP_DIR, pagePath)}`)
                continue
            }
            const componentName = exportMatch[1]

            // Rename original to _ClientPage.tsx
            const clientPagePath = path.join(dir, '_ClientPage.tsx')
            fs.renameSync(pagePath, clientPagePath)
            MODIFIED_FILES.push({ original: pagePath, renamed: clientPagePath })

            // Check if the component expects params
            const hasParams = content.includes('params:') || content.includes('PageProps')

            // Create wrapper page.tsx
            const wrapperContent = hasParams
                ? `// Auto-generated wrapper for static export
import ClientPage from './_ClientPage'

export function generateStaticParams() {
    return []
}

export default function Page(props: any) {
    return <ClientPage {...props} />
}
`
                : `// Auto-generated wrapper for static export
import ClientPage from './_ClientPage'

export function generateStaticParams() {
    return []
}

export default function Page() {
    return <ClientPage />
}
`
            fs.writeFileSync(pagePath, wrapperContent)
            WRAPPER_FILES.push(pagePath)

            console.log(`  ↳ Wrapped: ${path.relative(APP_DIR, pagePath)}`)
        } else {
            // Server component - just add generateStaticParams
            MODIFIED_FILES.push({ path: pagePath, original: content, type: 'content' })

            const staticParamsExport = `// Added for static export compatibility
export function generateStaticParams() {
    return []
}

`
            const newContent = staticParamsExport + content
            fs.writeFileSync(pagePath, newContent)

            console.log(`  ↳ Added generateStaticParams: ${path.relative(APP_DIR, pagePath)}`)
        }
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
        disableItems()
        wrapClientComponents()

        // Clean build cache to ensure fresh build
        console.log('🧹 Cleaning build cache...')
        if (fs.existsSync(path.join(__dirname, '..', '.next'))) {
            fs.rmSync(path.join(__dirname, '..', '.next'), { recursive: true })
        }

        console.log('\n🏗️  Building static export...\n')
        execSync('NATIVE_BUILD=true next build --webpack', {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, NATIVE_BUILD: 'true' },
        })

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
