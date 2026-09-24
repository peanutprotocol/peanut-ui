#!/usr/bin/env node
// backdoor-scan — does a change hide code that runs on a developer's machine
// or in CI?
//
// On 2025-07-01 an attacker holding a developer's GitHub credentials pushed
// two commits to peanut-ui that each changed one line of tailwind.config.js:
// the closing `}` became `};`, then 709 spaces, then ~3.3k characters of
// obfuscated JavaScript. In a diff it looked like a one-character change.
// `pnpm dev` loads the Tailwind config, so two reviewers who ran the branch
// executed a loader that fetched a second stage from a BNB Chain transaction
// and ran it as a hidden, detached node process. Three machines were wiped and
// ~$8k was drained. (Notion: Incidents → 2025-07-02 "malicious script in commits".)
//
// This scans only the lines a diff ADDS, so existing code never trips it.
//   block -- exit 1: hidden code, bidi controls, loader signatures, and any
//            suspicious pattern inside a file that runs at install/dev/build.
//   warn  -- reported, exit 0: suspicious patterns elsewhere, zero-width
//            characters, any change to an install/dev/build file.
//   jev   -- optional second layer (--jev, TYPESAFE_API_KEY): a fast model
//            judges each file's added lines. >= 0.8 "malicious" blocks.
//
// It never executes the code it reads.
//
// Originated in mono/scripts/backdoor-scan.mjs and mirrored into peanut-ui and
// peanut-api-ts. Keep security fixes in sync across copies. CI runs the copy
// from the PR's BASE branch, so a PR cannot weaken the scan that judges it.
//
// Usage:
//   node scripts/backdoor-scan.mjs --base origin/dev [--head HEAD] [--jev] [--allow-ref origin/dev]
//   node scripts/backdoor-scan.mjs --local            # working tree vs merge-base with origin/dev
//   node scripts/backdoor-scan.mjs --diff-file x.diff # scan a saved unified diff
//   add --guard to never fail on the scanner's own errors (no origin/dev yet,
//   not a git checkout): used in front of `pnpm dev`, where a broken scan must
//   not stop work but a blocking finding must.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CODE_FILE = /\.(c|m)?(j|t)sx?$|\.(sh|bash|zsh|ya?ml|json|py)$|(^|\/)(Dockerfile|Makefile)$|(^|\/)\.[a-z]+rc$/i

// Files that run on their own when someone installs, runs `pnpm dev`, builds
// or opens the repo. The 2025 payload lived in one. Nobody reads these closely,
// and none of them has a reason to decode strings or fetch code.
const EXEC_CONFIG = [
	/(^|\/)[^/]*\.config\.(c|m)?(j|t)s$/i, // tailwind, next, postcss, eslint, jest, vitest, playwright...
	/(^|\/)\.?(babel|postcss|eslint|prettier|lint-staged)rc(\.(c|m)?js|\.json)?$/i,
	/(^|\/)package\.json$/,
	/(^|\/)\.npmrc$/,
	/(^|\/)\.?pnpmfile\.c?js$/,
	/(^|\/)\.husky\//,
	/(^|\/)\.vscode\//,
	/(^|\/)\.devcontainer\//,
	/(^|\/)(instrumentation|middleware)\.(t|j)s$/,
	// decides what git shows as a diff: `-diff` turned a file into "Binary files differ"
	/(^|\/)\.gitattributes$/,
]
// Also run by hooks or CI, but they legitimately start processes and fetch
// things, so a suspicious pattern here is a warning, not a block.
const EXEC_SCRIPT = [/^\.github\/workflows\//, /^scripts\//]

// Seen in the 2025 payload and its family. Never legitimate in our code.
const LOADER_SIGNATURES = [
	[/global\s*\[\s*['"`](r|_V|_H|_module)['"`]\s*\]\s*=/, 'assigns a loader global (global.r / _V / _H)'],
	[/\bglobal\s*\[\s*['"`]r['"`]\s*\]\s*\(/, 'calls require through a global alias'],
	[/(['"`])[^'"`]{400,}\1\s*\)\s*\)\s*;?\s*$/, 'decodes and runs a very long encoded string'],
]

// Legitimate somewhere in the codebase, so only a warning -- unless inside an
// exec-surface file, where the 2025 payload ran.
const SUSPICIOUS = [
	[/(^|[^.\w$])eval\s*\(/, 'eval()'],
	[/\bnew\s+Function\s*\(|\bFunction\s*\(\s*['"`]/, 'builds a function from a string'],
	[/\bchild_process\b|\bexecSync\s*\(|\bspawn\s*\(/, 'starts a child process'],
	[/detached\s*:\s*true/, 'detached child process'],
	[/fromCharCode\([^)]*\^|charCodeAt\([^)]*\)\s*\^/, 'XOR string decoding'],
	[/https?:\/\/(?!(127\.|0\.0\.0\.0|10\.|192\.168\.|localhost))\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, 'URL with a raw public IP'],
	[/bsc-dataseed|aptoslabs\.com|api\.telegram\.org\/bot|pastebin\.com|discord(app)?\.com\/api\/webhooks/, 'host used by loaders to fetch or exfiltrate'],
	[/\batob\s*\(|Buffer\.from\([^)]*['"`](base64|hex)['"`]\)\s*\.toString\(/, 'decodes base64/hex at runtime'],
	[/process\.env\b[^;]{0,80}(https?:|fetch\(|request\()/, 'sends environment variables over the network'],
	[/\.ssh\/|id_rsa|\.aws\/credentials|Local Storage\/leveldb|Login Data|keychain/i, 'reads credential or wallet stores'],
]

const HIDDEN_RUN = /\S[ \t]{60,}\S/ // code far to the right of visible code
const BIDI = /[\u202A-\u202E\u2066-\u2069]/ // Trojan Source controls
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/
const LONG_LINE = 1000

export function execTier(path) {
	if (EXEC_CONFIG.some((pattern) => pattern.test(path))) return 'config'
	if (EXEC_SCRIPT.some((pattern) => pattern.test(path))) return 'script'
	return null
}

/**
 * Added lines per file from a unified diff: [{ path, line, text }].
 *
 * Hunk bodies are consumed by their line counts. A header is only read
 * between hunks: otherwise an added line whose text is `++ b/README.md` shows
 * up as `+++ b/README.md` and would re-label every line after it as a
 * markdown file, out of reach of the code checks.
 */
export function addedLines(diff) {
	const out = []
	const rows = diff.split('\n')
	let path = null
	for (let i = 0; i < rows.length; i += 1) {
		const raw = rows[i]
		if (raw.startsWith('diff --git ')) {
			path = null
			continue
		}
		if (raw.startsWith('+++ ')) {
			const target = raw.slice(4).trim()
			path = target === '/dev/null' ? null : target.replace(/^b\//, '')
			continue
		}
		const hunk = raw.match(/^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
		if (!hunk) continue
		let oldLeft = hunk[1] === undefined ? 1 : Number(hunk[1])
		let newLeft = hunk[3] === undefined ? 1 : Number(hunk[3])
		let line = Number(hunk[2])
		while ((oldLeft > 0 || newLeft > 0) && i + 1 < rows.length) {
			i += 1
			const body = rows[i]
			if (body.startsWith('\\')) continue // "\ No newline at end of file"
			const kind = body[0]
			if (kind === '+') {
				if (path) out.push({ path, line, text: body.slice(1) })
				line += 1
				newLeft -= 1
			} else if (kind === '-') {
				oldLeft -= 1
			} else {
				line += 1
				oldLeft -= 1
				newLeft -= 1
			}
		}
	}
	return out
}

/** Files the diff reports as binary. For a code file that means its lines were never read. */
export function binaryFiles(diff) {
	const out = []
	for (const raw of diff.split('\n')) {
		const match = raw.match(/^Binary files (?:a\/)?(.+?) and (?:b\/)?(.+?) differ$/)
		if (match) out.push(match[2] === '/dev/null' ? match[1] : match[2])
	}
	return out
}

export function binaryFindings(paths) {
	return paths
		.filter((path) => CODE_FILE.test(path) || execTier(path))
		.map((path) => ({ level: 'block', rule: 'binary-code-change', path, line: 0, detail: 'a code or config file changed as "binary", so its lines could not be read' }))
}

export function lineHash(text) {
	return createHash('sha256').update(text.trim()).digest('hex')
}

/** Deterministic findings for the added lines. */
export function scanLines(lines, { allow = new Set() } = {}) {
	const findings = []
	const add = (level, rule, entry, detail) => {
		if (allow.has(lineHash(entry.text))) return
		findings.push({ level, rule, path: entry.path, line: entry.line, detail })
	}
	const surfaces = new Set()
	for (const entry of lines) {
		const tier = execTier(entry.path)
		const exec = tier === 'config'
		if (tier) surfaces.add(entry.path)
		// Code only: with --text, image and font bytes can spell these characters by chance.
		if (!CODE_FILE.test(entry.path)) continue
		if (BIDI.test(entry.text)) add('block', 'bidi-control', entry, 'right-to-left/isolate control character (Trojan Source)')
		if (HIDDEN_RUN.test(entry.text)) {
			const run = entry.text.match(/[ \t]{60,}/)[0].length
			add('block', 'hidden-code', entry, `${run} spaces, then more code off-screen`)
		}
		if (entry.text.length > LONG_LINE) {
			add(tier ? 'block' : 'warn', 'very-long-line', entry, `${entry.text.length} characters on one line`)
		}
		if (ZERO_WIDTH.test(entry.text)) add('warn', 'zero-width-char', entry, 'invisible zero-width character')
		for (const [pattern, why] of LOADER_SIGNATURES) {
			if (pattern.test(entry.text)) add('block', 'loader-signature', entry, why)
		}
		for (const [pattern, why] of SUSPICIOUS) {
			if (pattern.test(entry.text)) add(exec ? 'block' : 'warn', 'suspicious', entry, `${why}${exec ? ' in a file that runs at install/dev/build' : ''}`)
		}
	}
	for (const path of surfaces) {
		findings.push({ level: 'warn', rule: 'exec-surface-changed', path, line: 0, detail: 'this file runs on install, dev, build or CI -- read every added line' })
	}
	return findings
}

const JEV_QUESTIONS = {
	malicious: {
		type: 'noul',
		instructions:
			'Is `added_lines` likely a malicious backdoor -- code that downloads, decodes or runs hidden code, steals secrets or credentials, or is deliberately hidden from a reviewer -- rather than an ordinary change?',
	},
	hidden_or_obfuscated: {
		type: 'noul',
		instructions: 'Does `added_lines` contain obfuscated code, or code placed where a reviewer would not see it?',
	},
}

/**
 * Second layer: Jev judges every file with added code, whole, in chunks that
 * fit its context. Nothing is skipped: a short file behind 25 large ones, or
 * the tail of a large file, is exactly where a payload would go.
 */
export async function jevFindings(lines, { key, fetchImpl = fetch, budget = 60000, concurrency = 8 } = {}) {
	const byFile = new Map()
	for (const entry of lines) {
		if (!CODE_FILE.test(entry.path)) continue
		byFile.set(entry.path, `${byFile.get(entry.path) || ''}${entry.text}\n`)
	}
	const jobs = []
	for (const [path, text] of byFile) {
		for (let start = 0; start < text.length; start += budget) jobs.push({ path, text: text.slice(start, start + budget) })
	}
	const verdicts = new Map()
	const failed = new Map()
	const queue = [...jobs]
	await Promise.all(
		Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
			while (queue.length) {
				const { path, text } = queue.shift()
				try {
					const response = await fetchImpl('https://api.typesafe.ai/v1/systemone', {
						method: 'POST',
						headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
						body: JSON.stringify({ model: 'jev-latest', state: { file: path, added_lines: text }, questions: JEV_QUESTIONS }),
						signal: AbortSignal.timeout(20000),
					})
					if (!response.ok) throw new Error(`HTTP ${response.status}`)
					const answers = (await response.json()).answers || {}
					const malicious = Number(answers.malicious?.noul)
					const hidden = Number(answers.hidden_or_obfuscated?.noul)
					// A reply without a score is no verdict. Stored as NaN it would
					// win every later comparison and mask a real 0.95 on another chunk.
					if (!Number.isFinite(malicious)) throw new Error('reply had no malicious score')
					const worst = verdicts.get(path)
					if (!worst || malicious > worst.malicious) verdicts.set(path, { malicious, hidden })
				} catch (error) {
					failed.set(path, error.message)
				}
			}
		})
	)
	const findings = []
	for (const [path, { malicious, hidden }] of verdicts) {
		if (malicious >= 0.8) findings.push({ level: 'block', rule: 'jev-malicious', path, line: 0, detail: `Jev: ${malicious.toFixed(2)} likely malicious, ${hidden.toFixed(2)} hidden/obfuscated` })
		else if (malicious >= 0.5) findings.push({ level: 'warn', rule: 'jev-suspicious', path, line: 0, detail: `Jev: ${malicious.toFixed(2)} likely malicious` })
	}
	for (const [path, message] of failed) {
		findings.push({ level: 'warn', rule: 'jev-unavailable', path, line: 0, detail: `Jev did not answer (${message}); deterministic checks still ran` })
	}
	return findings
}

function git(args) {
	return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
}

function readAllowList(ref) {
	if (!ref) return new Set()
	try {
		return new Set(
			git(['show', `${ref}:.github/backdoor-scan-allow.txt`])
				.split('\n')
				.map((l) => l.replace(/#.*/, '').trim())
				.filter(Boolean)
		)
	} catch {
		return new Set()
	}
}

function args(argv) {
	const out = {}
	for (let i = 0; i < argv.length; i += 1) {
		const key = argv[i].replace(/^--/, '')
		const next = argv[i + 1]
		if (next && !next.startsWith('--')) {
			out[key] = next
			i += 1
		} else out[key] = true
	}
	return out
}

function report(findings) {
	const inCi = Boolean(process.env.GITHUB_ACTIONS)
	for (const f of findings) {
		const where = f.line ? `${f.path}:${f.line}` : f.path
		if (inCi) {
			const kind = f.level === 'block' ? 'error' : 'warning'
			console.log(`::${kind} file=${f.path}${f.line ? `,line=${f.line}` : ''},title=backdoor-scan ${f.rule}::${f.detail}`)
		} else {
			console.log(`${f.level === 'block' ? 'BLOCK' : 'warn '} ${f.rule.padEnd(22)} ${where}  ${f.detail}`)
		}
	}
}

async function main() {
	const opts = args(process.argv.slice(2))
	let diff
	if (opts['diff-file']) diff = readFileSync(opts['diff-file'], 'utf8')
	else if (opts.local) {
		const baseRef = typeof opts.base === 'string' ? opts.base : 'origin/dev'
		const mergeBase = git(['merge-base', baseRef, 'HEAD']).trim()
		diff = git(['diff', '--no-color', '--no-ext-diff', '--no-textconv', '--text', '--unified=0', mergeBase])
	} else {
		if (!opts.base) throw new Error('--base <ref> is required (or --local / --diff-file)')
		// --text: a PR can add `.gitattributes` with `file -diff`, which prints
		// "Binary files differ" instead of the lines. --no-textconv: nor may it
		// swap in a filter that rewrites what we read.
		diff = git(['diff', '--no-color', '--no-ext-diff', '--no-textconv', '--text', '--unified=0', `${opts.base}...${typeof opts.head === 'string' ? opts.head : 'HEAD'}`])
	}
	const lines = addedLines(diff)
	const allowRef = typeof opts['allow-ref'] === 'string' ? opts['allow-ref'] : typeof opts.base === 'string' ? opts.base : null
	const findings = [...scanLines(lines, { allow: readAllowList(allowRef) }), ...binaryFindings(binaryFiles(diff))]
	const key = process.env.TYPESAFE_API_KEY
	if (opts.jev && key) findings.push(...(await jevFindings(lines, { key })))
	else if (opts.jev) findings.push({ level: 'warn', rule: 'jev-unavailable', path: '-', line: 0, detail: 'no TYPESAFE_API_KEY; deterministic checks only' })
	report(findings)
	const blocks = findings.filter((f) => f.level === 'block')
	console.log(
		blocks.length
			? `\nbackdoor-scan: ${blocks.length} blocking finding(s) in ${lines.length} added lines. Do NOT run this code. If a finding is a false positive, add the line's sha256 (trimmed) to .github/backdoor-scan-allow.txt on the base branch.`
			: `backdoor-scan: clean (${lines.length} added lines, ${findings.length} warning(s))`
	)
	process.exitCode = blocks.length ? 1 : 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		const guard = process.argv.includes('--guard')
		console.error(`backdoor-scan ${guard ? 'skipped' : 'failed'}: ${error.message.split('\n')[0]}`)
		process.exitCode = guard ? 0 : 2
	})
}
