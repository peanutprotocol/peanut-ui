#!/usr/bin/env npx tsx
/**
 * Generate a visual regression report from E2E screenshots.
 *
 * Groups screenshots by flow, shows current vs baseline side-by-side.
 * Run after Playwright tests:
 *   npx tsx e2e/scripts/generate-report.ts
 *
 * Flags:
 *   --save-baseline   Save current screenshots as the new baseline
 */

import * as fs from 'fs'
import * as path from 'path'

const RESULTS_DIR = path.resolve(__dirname, '../__results__')
const BASELINE_DIR = path.resolve(__dirname, '../__baseline__')
const REPORT_PATH = path.resolve(__dirname, '../__report__/visual-review.html')

const saveBaseline = process.argv.includes('--save-baseline')

// ── Helpers ──────────────────────────────────────────────────────────────

interface Screenshot {
	name: string
	path: string
	relativePath: string
	baselinePath: string | null
	ariaPath: string | null
	metaPath: string | null
}

interface Flow {
	id: string
	label: string
	screenshots: Screenshot[]
}

function extractFlowLabel(dirName: string): string {
	// e.g. "home-Home-page-authenticated-home-renders-with-core-elements-mobile"
	// → "Home page — authenticated home renders with core elements"
	const parts = dirName.split('-')

	// Find the spec name prefix (first segment before the test describe name)
	const specNames = [
		'Home', 'Claim', 'Send', 'Withdraw', 'Setup', 'QR',
		'KYC', 'Profile', 'Public', 'Dev', 'Request',
	]

	let label = dirName
	for (const spec of specNames) {
		const idx = dirName.indexOf(spec)
		if (idx > 0) {
			label = dirName.slice(idx).replace(/-mobile$/, '').replace(/-retry\d+$/, '')
			break
		}
	}

	return label
		.replace(/--/g, ' — ')
		.replace(/-/g, ' ')
		.replace(/\b[a-f0-9]{5}\b/g, '') // remove hash fragments
		.replace(/\s+/g, ' ')
		.trim()
}

function groupByFlow(resultsDir: string): Flow[] {
	if (!fs.existsSync(resultsDir)) return []

	const dirs = fs.readdirSync(resultsDir).filter(d => {
		const full = path.join(resultsDir, d)
		return fs.statSync(full).isDirectory() && !d.startsWith('.')
	})

	// Group directories by spec file (first segment before the hash)
	const flowMap = new Map<string, Flow>()

	for (const dir of dirs) {
		// Skip retries — only show the final result
		if (dir.includes('-retry')) continue

		const flowKey = dir.split('-').slice(0, 2).join('-')
		const label = extractFlowLabel(dir)

		if (!flowMap.has(flowKey)) {
			flowMap.set(flowKey, { id: flowKey, label: label.split(' ')[0], screenshots: [] })
		}
		const flow = flowMap.get(flowKey)!

		// Find PNGs in this directory
		const fullDir = path.join(resultsDir, dir)
		const pngs = fs.readdirSync(fullDir)
			.filter(f => f.endsWith('.png'))
			.sort()

		for (const png of pngs) {
			const screenshotPath = path.join(fullDir, png)
			const relativePath = path.relative(path.dirname(REPORT_PATH), screenshotPath)
			const baseName = png.replace('.png', '')

			// Check for baseline
			const baselineFile = path.join(BASELINE_DIR, dir, png)
			const baselinePath = fs.existsSync(baselineFile)
				? path.relative(path.dirname(REPORT_PATH), baselineFile)
				: null

			// Check for aria snapshot
			const ariaFile = path.join(fullDir, `${baseName}-aria.txt`)
			const ariaPath = fs.existsSync(ariaFile) ? ariaFile : null

			// Check for meta
			const metaFile = path.join(fullDir, `${baseName}-meta.json`)
			const metaPath = fs.existsSync(metaFile) ? metaFile : null

			flow.screenshots.push({
				name: `${label} / ${baseName}`,
				path: screenshotPath,
				relativePath,
				baselinePath,
				ariaPath,
				metaPath,
			})
		}
	}

	return Array.from(flowMap.values()).sort((a, b) => a.id.localeCompare(b.id))
}

// ── Save baseline ────────────────────────────────────────────────────────

function copyBaseline() {
	if (fs.existsSync(BASELINE_DIR)) {
		fs.rmSync(BASELINE_DIR, { recursive: true })
	}
	fs.mkdirSync(BASELINE_DIR, { recursive: true })

	const dirs = fs.readdirSync(RESULTS_DIR).filter(d => {
		return fs.statSync(path.join(RESULTS_DIR, d)).isDirectory() && !d.startsWith('.')
	})

	let count = 0
	for (const dir of dirs) {
		if (dir.includes('-retry')) continue
		const srcDir = path.join(RESULTS_DIR, dir)
		const dstDir = path.join(BASELINE_DIR, dir)
		fs.mkdirSync(dstDir, { recursive: true })

		for (const f of fs.readdirSync(srcDir).filter(f => f.endsWith('.png'))) {
			fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f))
			count++
		}
	}
	console.log(`[report] Saved ${count} screenshots as baseline to ${BASELINE_DIR}`)
}

// ── Generate HTML ────────────────────────────────────────────────────────

function generateHTML(flows: Flow[]): string {
	const hasBaseline = flows.some(f => f.screenshots.some(s => s.baselinePath))
	const totalScreenshots = flows.reduce((n, f) => n + f.screenshots.length, 0)
	const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)

	const flowSections = flows.map(flow => {
		const cards = flow.screenshots.map(s => {
			let aria = ''
			if (s.ariaPath) {
				try { aria = fs.readFileSync(s.ariaPath, 'utf-8').slice(0, 500) } catch {}
			}

			let meta = ''
			if (s.metaPath) {
				try {
					const m = JSON.parse(fs.readFileSync(s.metaPath, 'utf-8'))
					meta = `${m.url} · ${m.viewport?.width}×${m.viewport?.height}`
				} catch {}
			}

			const hasError = aria.includes('Error') || aria.includes('Application error')
			const badge = hasError ? '<span class="badge error">ERROR</span>' : ''

			// Stack both images; JS toggle controls which is visible
			const baselineImg = s.baselinePath
				? `<img class="img-baseline" src="${s.baselinePath}" loading="lazy" style="display:none" />`
				: ''

			return `
				<div class="card ${hasError ? 'has-error' : ''}" ${s.baselinePath ? 'data-has-baseline' : ''}>
					<div class="card-header">
						<span class="step-name">${s.name.split(' / ').pop()}</span>
						${badge}
						${meta ? `<span class="meta">${meta}</span>` : ''}
					</div>
					<div class="img-wrap">
						<img class="img-current" src="${s.relativePath}" loading="lazy" />
						${baselineImg}
					</div>
					${aria && hasError ? `<details><summary>Aria</summary><pre>${escapeHtml(aria)}</pre></details>` : ''}
				</div>`
		}).join('\n')

		return `
			<section class="flow" id="${flow.id}">
				<h2>${flow.label} <span class="count">(${flow.screenshots.length})</span></h2>
				<div class="grid">${cards}</div>
			</section>`
	}).join('\n')

	const nav = flows.map(f =>
		`<a href="#${f.id}">${f.label} (${f.screenshots.length})</a>`
	).join('')

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Peanut Visual Regression Report</title>
<style>
	* { box-sizing: border-box; margin: 0; padding: 0; }
	body { font-family: -apple-system, system-ui, sans-serif; background: #f5f5f0; color: #1a1a1a; }

	header { background: #1a1a1a; color: #fff; padding: 16px 24px; position: sticky; top: 0; z-index: 10; }
	header h1 { font-size: 18px; font-weight: 600; }
	header .stats { font-size: 13px; color: #aaa; margin-top: 2px; }

	nav { background: #fff; border-bottom: 1px solid #ddd; padding: 8px 24px; display: flex; gap: 8px; flex-wrap: wrap; position: sticky; top: 52px; z-index: 9; }
	nav a { font-size: 12px; padding: 4px 10px; border-radius: 12px; background: #f0f0f0; color: #333; text-decoration: none; white-space: nowrap; }
	nav a:hover { background: #e0e0e0; }

	.toolbar { padding: 8px 24px; background: #fff; border-bottom: 1px solid #eee; display: flex; gap: 16px; align-items: center; position: sticky; top: 88px; z-index: 8; }
	.toolbar label { font-size: 13px; cursor: pointer; user-select: none; }
	.toolbar input[type="checkbox"] { margin-right: 4px; }

	/* Toggle switch */
	.toggle-wrap { display: flex; align-items: center; gap: 8px; }
	.toggle-label { font-size: 12px; font-weight: 600; }
	.toggle-label.active { color: #FF90E8; }
	.toggle { position: relative; width: 44px; height: 24px; cursor: pointer; }
	.toggle input { opacity: 0; width: 0; height: 0; }
	.toggle .slider { position: absolute; inset: 0; background: #ccc; border-radius: 24px; transition: 0.2s; }
	.toggle .slider:before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.2s; }
	.toggle input:checked + .slider { background: #FF90E8; }
	.toggle input:checked + .slider:before { transform: translateX(20px); }

	.flow { padding: 24px; }
	.flow h2 { font-size: 16px; margin-bottom: 12px; border-bottom: 2px solid #FF90E8; padding-bottom: 4px; display: inline-block; }
	.flow .count { color: #888; font-weight: 400; }

	.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }

	.card { background: #fff; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; transition: border-color 0.15s; }
	.card.has-error { border-color: #e74c3c; border-width: 2px; }
	.card.showing-baseline { border-color: #3498db; }
	.card-header { padding: 6px 10px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 6px; }
	.step-name { font-size: 12px; font-weight: 600; }
	.meta { font-size: 10px; color: #888; margin-left: auto; }

	.badge { font-size: 10px; padding: 1px 5px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
	.badge.error { background: #ffeaea; color: #c0392b; }

	.img-wrap { position: relative; }
	.img-wrap img { width: 100%; display: block; }

	details { padding: 6px 10px; border-top: 1px solid #eee; }
	details summary { font-size: 11px; color: #666; cursor: pointer; }
	details pre { font-size: 10px; white-space: pre-wrap; margin-top: 4px; max-height: 120px; overflow-y: auto; background: #f8f8f8; padding: 6px; border-radius: 4px; }

	kbd { background: #eee; border: 1px solid #ccc; border-radius: 3px; padding: 1px 5px; font-size: 11px; }
</style>
</head>
<body>
	<header>
		<h1>Peanut Visual Regression Report</h1>
		<div class="stats">${totalScreenshots} screenshots · ${flows.length} flows · ${timestamp}${hasBaseline ? ' · baseline loaded' : ' · no baseline yet'}</div>
	</header>
	<nav>${nav}</nav>
	<div class="toolbar">
		${hasBaseline ? `
		<div class="toggle-wrap">
			<span class="toggle-label" id="lbl-current">Current</span>
			<label class="toggle">
				<input type="checkbox" id="toggle-baseline" />
				<span class="slider"></span>
			</label>
			<span class="toggle-label" id="lbl-baseline">Baseline</span>
		</div>
		<span style="font-size:11px;color:#888">Hold <kbd>B</kbd> to peek at baseline</span>
		` : '<span style="font-size:12px;color:#888">No baseline. Run <code>npx tsx e2e/scripts/generate-report.ts --save-baseline</code> to set one.</span>'}
		<label style="margin-left:auto"><input type="checkbox" id="errors-only" /> Errors only</label>
	</div>
	${flowSections}
	<script>
	(function() {
		var toggle = document.getElementById('toggle-baseline')
		var lblCurrent = document.getElementById('lbl-current')
		var lblBaseline = document.getElementById('lbl-baseline')

		function setView(showBaseline) {
			document.querySelectorAll('.card[data-has-baseline]').forEach(function(card) {
				var current = card.querySelector('.img-current')
				var baseline = card.querySelector('.img-baseline')
				if (!baseline) return
				current.style.display = showBaseline ? 'none' : 'block'
				baseline.style.display = showBaseline ? 'block' : 'none'
				card.classList.toggle('showing-baseline', showBaseline)
			})
			if (lblCurrent) lblCurrent.classList.toggle('active', !showBaseline)
			if (lblBaseline) lblBaseline.classList.toggle('active', showBaseline)
		}

		if (toggle) {
			toggle.addEventListener('change', function() { setView(this.checked) })

			// Hold B to peek
			document.addEventListener('keydown', function(e) {
				if (e.key === 'b' && !e.repeat && !toggle.checked) {
					toggle.checked = true
					setView(true)
				}
			})
			document.addEventListener('keyup', function(e) {
				if (e.key === 'b' && toggle.checked) {
					toggle.checked = false
					setView(false)
				}
			})

			setView(false)
		}

		document.getElementById('errors-only').addEventListener('change', function() {
			document.querySelectorAll('.card').forEach(function(c) {
				c.style.display = (this.checked && !c.classList.contains('has-error')) ? 'none' : ''
			}.bind(this))
		})
	})()
	</script>
</body>
</html>`
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Main ─────────────────────────────────────────────────────────────────

if (saveBaseline) {
	copyBaseline()
}

const flows = groupByFlow(RESULTS_DIR)
if (flows.length === 0) {
	console.error('[report] No results found in', RESULTS_DIR)
	console.error('Run: npx playwright test --project=mobile')
	process.exit(1)
}

const html = generateHTML(flows)
fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
fs.writeFileSync(REPORT_PATH, html)
console.log(`[report] Generated ${REPORT_PATH}`)
console.log(`[report] ${flows.length} flows, ${flows.reduce((n, f) => n + f.screenshots.length, 0)} screenshots`)
console.log(`[report] Open: file://${REPORT_PATH}`)

if (!fs.existsSync(BASELINE_DIR)) {
	console.log(`[report] No baseline yet. Run with --save-baseline to save current as baseline.`)
}
