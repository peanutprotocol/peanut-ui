import rawModel from './model/stuck-scorer.v1.json'
import type { GbdtNode, StuckJourney, StuckModelArtifact, StuckScoreInput, StuckScoreResult } from './types'

const JOURNEY_ORDER: readonly Exclude<StuckJourney, 'other'>[] = [
    'signup',
    'kyc',
    'account_setup',
    'deposit',
    'qr_pay',
    'withdraw',
    'card',
    'send',
]

export const STUCK_MODEL = rawModel as unknown as StuckModelArtifact

/** Evaluate a single compact decision tree node without recursion overhead. */
export function evaluateTree(root: GbdtNode, features: readonly number[]): number {
    let node: GbdtNode = root
    while (node.length === 4) {
        const value = features[node[0]] ?? 0
        node = value <= node[1] ? node[2] : node[3]
    }
    return node[0]
}

/**
 * Evaluate the compact GBDT artifact into a calibrated probability in (0, 1).
 * Clamps logits to [-20, 20] matching the Python trainer (`train_stuck_model.py`).
 */
export function evaluateGbdt(model: StuckModelArtifact, features: readonly number[]): number {
    let logit = model.baseLogit
    for (let i = 0; i < model.trees.length; i++) {
        logit += model.learningRate * evaluateTree(model.trees[i], features)
    }
    const clamped = Math.max(-20, Math.min(20, logit))
    return 1 / (1 + Math.exp(-clamped))
}

/**
 * Map live client signals + localStorage cross-session memory into the exact
 * 25-feature vector expected by `stuck-scorer.v1.json`.
 */
export function buildFeatureVector(input: StuckScoreInput): number[] {
    const dur = Math.max(0, input.durationSeconds)
    const sessNum = Math.max(1, input.memory.sessionCount)
    const vec: number[] = [
        input.flags.appError ? 1 : 0,
        input.flags.rageTaps ? 1 : 0,
        input.flags.longIdle ? 1 : 0,
        input.flags.moneyFailed ? 1 : 0,
        input.flags.moneyStuck ? 1 : 0,
        input.flags.kycBlocked ? 1 : 0,
        Math.log1p(dur),
        dur >= 120 ? 1 : 0,
        dur >= 300 ? 1 : 0,
        sessNum === 1 ? 1 : 0,
        input.loggedIn ? 1 : 0,
        Math.log1p(sessNum),
        Math.log1p(Math.max(0, input.memory.priorObsFriction)),
        Math.log1p(Math.max(0, input.memory.priorStuck)),
        input.memory.prevWasStuck ? 1 : 0,
    ]
    for (const j of JOURNEY_ORDER) {
        vec.push(input.journey === j ? 1 : 0)
    }
    vec.push(input.platform === 'ios-native' ? 1 : 0)
    vec.push(input.platform === 'android-native' ? 1 : 0)
    return vec
}

/**
 * Asymmetric hysteresis smoothing inspired by MoodRecognition.json:
 * rises smoothly on sustained friction, decays slowly to avoid UI flicker.
 */
export function applyHysteresis(previous: number, raw: number, riseAlpha = 0.55, fallAlpha = 0.2): number {
    const alpha = raw >= previous ? riseAlpha : fallAlpha
    const next = previous + alpha * (raw - previous)
    return Math.max(0, Math.min(1, next))
}

export function scoreStuckSession(
    input: StuckScoreInput,
    previousSmoothed = 0,
    model: StuckModelArtifact = STUCK_MODEL
): StuckScoreResult {
    const features = buildFeatureVector(input)
    const rawScore = evaluateGbdt(model, features)
    const smoothedScore = applyHysteresis(previousSmoothed, rawScore)
    return {
        rawScore,
        smoothedScore,
        features,
        modelVersion: model.version,
    }
}
