#!/usr/bin/env node
/**
 * Keeps public/client-support.json in step with its source of truth: the
 * compatibility registry in mono (engineering/compatibility/registry.json) at
 * the commit pinned in scripts/client-support-policy.lock.json.
 *
 *   node scripts/client-support-policy.mjs sync --registry <registry.json> --mono-sha <full sha>
 *   node scripts/client-support-policy.mjs proof --registry <registry.json> --mono-sha <full sha> --out <proof.json>
 *   node scripts/client-support-policy.mjs check (--registry <registry.json> | --proof <proof.json>)
 *
 * `sync` derives the public policy from the registry — exactly what mono's
 * `cli.mjs policy` emits: `{ schemaVersion: 1, minimumGeneration }` — writes
 * the snapshot, and records the pin plus the registry's canonical SHA-256 in
 * the lock. The lock never carries the registry itself: the registry is
 * private, the hash is not.
 *
 * `proof` is what CI derives in the job that holds the mono credential: the
 * same policy, pin and digest, and nothing else from the registry (no
 * releases, changes, owners, tasks or evidence). Only that public-safe file
 * travels between jobs; this repository is public and so are its artifacts.
 *
 * `check` fails when the snapshot is not the policy the source derives, or
 * when the source handed in (registry or proof) is not the one the lock
 * pinned. A source is required: a check with nothing to compare against is
 * not a check, so CI fails when the fetch did not happen.
 *
 * Dependency-free on purpose: CI runs it before (and without) `pnpm install`.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const PLATFORMS = ['web', 'ios', 'android']
export const LOCK_PATH = 'scripts/client-support-policy.lock.json'
export const SNAPSHOT_PATH = 'public/client-support.json'
const FULL_SHA = /^[a-f0-9]{40}$/
const DIGEST = /^[a-f0-9]{64}$/

/** Same canonical form as mono's compatibility core, so `cli.mjs hash` agrees. */
export function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
    if (value && typeof value === 'object') {
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
            .join(',')}}`
    }
    return JSON.stringify(value)
}

export function hash(value) {
    return createHash('sha256').update(canonical(value)).digest('hex')
}

function fail(message) {
    throw new Error(message)
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

function floors(value, what) {
    if (!isRecord(value) || Object.keys(value).length !== PLATFORMS.length)
        fail(`${what}: minimumGeneration must name exactly web, ios and android`)
    const out = {}
    for (const platform of PLATFORMS) {
        const floor = value[platform]
        if (!Number.isSafeInteger(floor) || floor < 0) fail(`${what}: ${platform} floor must be a non-negative integer`)
        out[platform] = floor
    }
    return out
}

/** The subset of mono's validateRegistry that the public policy depends on. */
export function policyFromRegistry(registry) {
    if (!isRecord(registry) || registry.schemaVersion !== 1 || registry.observationDays !== 7)
        fail('registry: expected schema v1 with a seven-day window')
    if (!Array.isArray(registry.releases) || !Array.isArray(registry.changes))
        fail('registry: missing releases or changes')
    return { schemaVersion: 1, minimumGeneration: floors(registry.minimumGeneration, 'registry') }
}

/** Strict: the exact public schema and nothing else, mirroring the app's parser. */
export function validatePolicy(policy) {
    if (!isRecord(policy) || policy.schemaVersion !== 1 || Object.keys(policy).length !== 2)
        fail('policy: expected exactly { schemaVersion: 1, minimumGeneration }')
    return { schemaVersion: 1, minimumGeneration: floors(policy.minimumGeneration, 'policy') }
}

export function validateLock(lock) {
    if (
        !isRecord(lock) ||
        lock.schemaVersion !== 1 ||
        lock.monoRepository !== 'peanutprotocol/mono' ||
        !FULL_SHA.test(lock.monoSha) ||
        lock.registryPath !== 'engineering/compatibility/registry.json' ||
        !DIGEST.test(lock.registrySha256)
    )
        fail('lock: expected a full mono SHA, the registry path and its canonical SHA-256')
    return lock
}

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'))
    } catch (error) {
        fail(`${path}: ${error.message}`)
    }
}

function format(value) {
    return JSON.stringify(value, null, 4) + '\n'
}

export function sync({ root, registryPath, monoSha }) {
    if (!registryPath) fail('sync needs --registry <path>')
    if (!FULL_SHA.test(monoSha ?? '')) fail('sync needs --mono-sha <full 40-character sha>')
    const registry = readJson(registryPath)
    const policy = policyFromRegistry(registry)
    const lock = {
        schemaVersion: 1,
        monoRepository: 'peanutprotocol/mono',
        monoSha,
        registryPath: 'engineering/compatibility/registry.json',
        registrySha256: hash(registry),
    }
    writeFileSync(resolve(root, SNAPSHOT_PATH), format(policy))
    writeFileSync(resolve(root, LOCK_PATH), format(lock))
    return { policy, lock }
}

/** The public-safe summary of a private registry at a pinned commit. */
export function proofFromRegistry(registry, monoSha) {
    if (!FULL_SHA.test(monoSha ?? '')) fail('proof needs --mono-sha <full 40-character sha>')
    return { schemaVersion: 1, monoSha, registrySha256: hash(registry), policy: policyFromRegistry(registry) }
}

export function validateProof(proof) {
    if (
        !isRecord(proof) ||
        proof.schemaVersion !== 1 ||
        !FULL_SHA.test(proof.monoSha) ||
        !DIGEST.test(proof.registrySha256) ||
        Object.keys(proof).length !== 4
    )
        fail('proof: expected exactly { schemaVersion: 1, monoSha, registrySha256, policy }')
    return { ...proof, policy: validatePolicy(proof.policy) }
}

export function check({ root, registryPath, proofPath }) {
    const lock = validateLock(readJson(resolve(root, LOCK_PATH)))
    const snapshot = validatePolicy(readJson(resolve(root, SNAPSHOT_PATH)))
    let source
    if (registryPath) {
        const registry = readJson(registryPath)
        source = { registrySha256: hash(registry), policy: policyFromRegistry(registry), monoSha: lock.monoSha }
    } else if (proofPath) {
        source = validateProof(readJson(proofPath))
    } else {
        fail('check needs the pinned source: --registry <registry.json> or --proof <proof.json>')
    }
    if (source.monoSha !== lock.monoSha) fail(`source is mono ${source.monoSha}, the lock pins ${lock.monoSha}`)
    if (source.registrySha256 !== lock.registrySha256)
        fail(
            `registry does not match the lock: pinned ${lock.registrySha256}, got ${source.registrySha256} — run sync with the new mono sha`
        )
    if (canonical(source.policy) !== canonical(snapshot))
        fail(`${SNAPSHOT_PATH} is not the policy the pinned registry derives: expected ${canonical(source.policy)}`)
    return { lock, snapshot }
}

function option(args, name) {
    const index = args.indexOf(name)
    return index < 0 ? undefined : args[index + 1]
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname
if (invokedDirectly) {
    const [command, ...args] = process.argv.slice(2)
    const root = option(args, '--root') ?? process.cwd()
    const registryPath = option(args, '--registry')
    try {
        if (command === 'sync') {
            const { policy, lock } = sync({ root, registryPath, monoSha: option(args, '--mono-sha') })
            console.log(`wrote ${SNAPSHOT_PATH} ${canonical(policy)} from mono ${lock.monoSha.slice(0, 7)}`)
        } else if (command === 'proof') {
            if (!registryPath) fail('proof needs --registry <path>')
            const out = option(args, '--out')
            if (!out) fail('proof needs --out <path>')
            const proof = proofFromRegistry(readJson(registryPath), option(args, '--mono-sha'))
            writeFileSync(resolve(out), format(proof))
            // The policy is public; the registry never reaches stdout.
            console.log(`wrote proof for mono ${proof.monoSha.slice(0, 7)}: ${canonical(proof.policy)}`)
        } else if (command === 'check') {
            const { lock, snapshot } = check({ root, registryPath, proofPath: option(args, '--proof') })
            console.log(`${SNAPSHOT_PATH} matches mono ${lock.monoSha.slice(0, 7)}: ${canonical(snapshot)}`)
        } else {
            fail(
                'usage: client-support-policy.mjs <sync|proof|check> [--registry <path>] [--proof <path>] [--mono-sha <sha>] [--out <path>] [--root <dir>]'
            )
        }
    } catch (error) {
        console.error(`✗ client-support-policy: ${error.message}`)
        process.exit(1)
    }
}
