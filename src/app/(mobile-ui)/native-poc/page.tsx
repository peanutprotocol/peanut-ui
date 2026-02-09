'use client'

import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { useState, useEffect } from 'react'
import { keccak256, type Hex, http, createPublicClient, encodeAbiParameters, type SignableMessage } from 'viem'
import { arbitrum } from 'viem/chains'
import {
    createKernelAccount,
    createKernelAccountClient,
    createZeroDevPaymasterClient,
} from '@zerodev/sdk'
import { toPasskeyValidator, PasskeyValidatorContractVersion } from '@zerodev/passkey-validator'
import { BUNDLER_URL, PAYMASTER_URL, USER_OP_ENTRY_POINT, ZERODEV_KERNEL_VERSION } from '@/constants/zerodev.consts'
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types'
import { p256 } from '@noble/curves/p256'
import { bytesToBigInt, hexToBytes } from 'viem'

// Diagnostic info about WebAuthn support
interface DiagnosticInfo {
    userAgent: string
    hasPublicKeyCredential: boolean
    hasNavigatorCredentials: boolean
    isSecureContext: boolean
    hostname: string
    protocol: string
    hasCapacitor: boolean
    uvpaAvailable: boolean | null
    conditionalMediationAvailable: boolean | null
    nativePluginAvailable: boolean | null
}

// WebAuthnKey type matching ZeroDev's expectations
interface WebAuthnKey {
    pubX: bigint
    pubY: bigint
    authenticatorId: string
    authenticatorIdHash: Hex
    rpID: string
    signMessageCallback?: (
        message: SignableMessage,
        rpId: string,
        chainId: number,
        allowCredentials?: PublicKeyCredentialRequestOptionsJSON['allowCredentials']
    ) => Promise<Hex>
}

// Store credential for signing test
interface StoredCredential {
    id: string
    rawId: string
    rpId: string
    publicKey?: string // base64 public key from registration
}

export default function NativePocPage() {
    const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [testResult, setTestResult] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [storedCredential, setStoredCredential] = useState<StoredCredential | null>(null)
    const [webAuthnKey, setWebAuthnKey] = useState<WebAuthnKey | null>(null)
    const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null)

    // Run diagnostics on mount
    useEffect(() => {
        const runDiagnostics = async () => {
            const info: DiagnosticInfo = {
                userAgent: navigator.userAgent,
                hasPublicKeyCredential: typeof PublicKeyCredential !== 'undefined',
                hasNavigatorCredentials: typeof navigator.credentials !== 'undefined',
                isSecureContext: window.isSecureContext,
                hostname: window.location.hostname,
                protocol: window.location.protocol,
                hasCapacitor: typeof (window as any).Capacitor !== 'undefined',
                uvpaAvailable: null,
                conditionalMediationAvailable: null,
                nativePluginAvailable: null,
            }

            // Check native plugin availability
            try {
                const { Webauthn } = await import('capacitor-webauthn')
                const result = await Webauthn.isWebAuthnAvailable()
                info.nativePluginAvailable = result.value
            } catch (e) {
                console.error('Native plugin check failed:', e)
                info.nativePluginAvailable = false
            }

            // Check platform authenticator availability
            if (info.hasPublicKeyCredential) {
                try {
                    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
                        info.uvpaAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                    }
                } catch (e) {
                    console.error('UVPA check failed:', e)
                }

                try {
                    if (PublicKeyCredential.isConditionalMediationAvailable) {
                        info.conditionalMediationAvailable = await PublicKeyCredential.isConditionalMediationAvailable()
                    }
                } catch (e) {
                    console.error('Conditional mediation check failed:', e)
                }
            }

            setDiagnostics(info)
        }

        runDiagnostics()
    }, [])

    // Try to create a passkey using raw WebAuthn API
    const testRawWebAuthn = async () => {
        setIsLoading(true)
        setError(null)
        setTestResult(null)

        try {
            if (typeof PublicKeyCredential === 'undefined') {
                throw new Error('PublicKeyCredential is not defined - WebAuthn not supported in this WebView')
            }

            // Create a simple passkey registration challenge
            const challenge = new Uint8Array(32)
            crypto.getRandomValues(challenge)

            const userId = new Uint8Array(16)
            crypto.getRandomValues(userId)

            const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
                challenge,
                rp: {
                    name: 'Peanut PoC Test',
                    id: window.location.hostname,
                },
                user: {
                    id: userId,
                    name: `test-user-${Date.now()}`,
                    displayName: 'Test User',
                },
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' },   // ES256
                    { alg: -257, type: 'public-key' }, // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                    residentKey: 'required',
                },
                timeout: 60000,
                attestation: 'none',
            }

            setTestResult('Calling navigator.credentials.create()...')

            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions,
            })

            if (credential) {
                setTestResult(`✅ SUCCESS! Passkey created. Credential ID: ${(credential as PublicKeyCredential).id.slice(0, 20)}...`)
            } else {
                setTestResult('❌ Credential creation returned null')
            }
        } catch (err: any) {
            console.error('WebAuthn test failed:', err)
            setError(err.message || 'Unknown error')
            setTestResult(`❌ FAILED: ${err.name} - ${err.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    // Test native plugin availability
    const testNativePlugin = async () => {
        setIsLoading(true)
        setError(null)
        setTestResult(null)

        try {
            const { Webauthn } = await import('capacitor-webauthn')

            setTestResult('Checking native WebAuthn availability...')

            const available = await Webauthn.isWebAuthnAvailable()

            if (available.value) {
                setTestResult('✅ Native WebAuthn plugin reports: AVAILABLE')
            } else {
                setTestResult('❌ Native WebAuthn plugin reports: NOT AVAILABLE')
            }
        } catch (err: any) {
            console.error('Native plugin test failed:', err)
            setError(err.message || 'Unknown error')
            setTestResult(`❌ Native plugin error: ${err.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    // Helper to convert ArrayBuffer to base64url
    const bufferToBase64URL = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer)
        let str = ''
        for (const byte of bytes) {
            str += String.fromCharCode(byte)
        }
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    }

    // Helper to convert base64url to Uint8Array
    const base64URLToBytes = (base64url: string): Uint8Array => {
        const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
        const binary = atob(padded)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
        }
        return bytes
    }

    // Helper to convert Uint8Array to hex string
    const uint8ArrayToHexString = (arr: Uint8Array): Hex => {
        return `0x${Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')}` as Hex
    }

    // Parse public key from registration response to extract X/Y coordinates
    const parsePublicKeyToWebAuthnKey = async (
        publicKeyBase64: string,
        authenticatorId: string,
        rpId: string
    ): Promise<WebAuthnKey> => {
        // The public key is in SPKI (SubjectPublicKeyInfo) format, base64 encoded
        const spkiDer = base64URLToBytes(publicKeyBase64)

        // Import the key using Web Crypto API
        const key = await crypto.subtle.importKey(
            'spki',
            spkiDer as BufferSource,
            {
                name: 'ECDSA',
                namedCurve: 'P-256',
            },
            true,
            ['verify']
        )

        // Export to raw format to get X/Y coordinates
        const rawKey = await crypto.subtle.exportKey('raw', key)
        const rawKeyBuffer = new Uint8Array(rawKey)

        // Raw format: 0x04 (uncompressed) + X (32 bytes) + Y (32 bytes)
        const pubKeyX = rawKeyBuffer.slice(1, 33)
        const pubKeyY = rawKeyBuffer.slice(33, 65)

        // Calculate authenticator ID hash
        const authenticatorIdBytes = base64URLToBytes(authenticatorId)
        const authenticatorIdHash = keccak256(uint8ArrayToHexString(authenticatorIdBytes))

        return {
            pubX: BigInt(uint8ArrayToHexString(pubKeyX)),
            pubY: BigInt(uint8ArrayToHexString(pubKeyY)),
            authenticatorId,
            authenticatorIdHash,
            rpID: rpId,
        }
    }

    // Create a signMessageCallback that uses the native Capacitor plugin
    // This replaces the browser WebAuthn API with native Android implementation
    const createNativeSignMessageCallback = (rpId: string) => {
        return async (
            message: SignableMessage,
            _rpId: string,
            _chainId: number,
            allowCredentials?: PublicKeyCredentialRequestOptionsJSON['allowCredentials']
        ): Promise<Hex> => {
            const { Webauthn } = await import('capacitor-webauthn')

            // Convert message to string for challenge
            let messageContent: string
            if (typeof message === 'string') {
                messageContent = message
            } else if ('raw' in message && typeof message.raw === 'string') {
                messageContent = message.raw
            } else if ('raw' in message && message.raw instanceof Uint8Array) {
                messageContent = uint8ArrayToHexString(message.raw)
            } else {
                throw new Error('Unsupported message format')
            }

            // Remove 0x prefix if present
            const formattedMessage = messageContent.startsWith('0x')
                ? messageContent.slice(2)
                : messageContent

            // Convert hex string to base64url for the challenge
            const messageBytes = new Uint8Array(formattedMessage.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
            const challenge = bufferToBase64URL(messageBytes.buffer)

            // Prepare assertion options for native plugin
            const assertionOptions = {
                challenge,
                rpId: rpId,
                allowCredentials: allowCredentials?.map(cred => ({
                    id: cred.id,
                    type: 'public-key' as const,
                })),
                userVerification: 'required' as const,
                timeout: 60000,
            }

            console.log('[NativePoC] Calling native startAuthentication for signing...')
            const cred = await Webauthn.startAuthentication(assertionOptions)

            // Parse the response like ZeroDev does
            const authenticatorData = base64URLToBytes(cred.response.authenticatorData)
            const authenticatorDataHex = uint8ArrayToHexString(authenticatorData)

            const clientDataJSON = atob(cred.response.clientDataJSON.replace(/-/g, '+').replace(/_/g, '/'))

            // Find quote indices for type location (must match ZeroDev's implementation)
            // ZeroDev looks for the full string '"type":"webauthn.get"'
            const findQuoteIndices = (input: string) => {
                const beforeTypeIndex = BigInt(input.lastIndexOf('"type":"webauthn.get"'))
                return { beforeType: beforeTypeIndex }
            }
            const { beforeType } = findQuoteIndices(clientDataJSON)

            // Parse and normalize signature using @noble/curves/p256 (same as ZeroDev)
            const signatureBytes = base64URLToBytes(cred.response.signature)
            const signatureHex = uint8ArrayToHexString(signatureBytes)
            const { r, s } = parseAndNormalizeSigNoble(signatureHex)

            // Check if network supports RIP-7212 precompile
            // Only Polygon (137) and Mumbai (80001) support it, NOT Arbitrum
            const isRIP7212Supported = [80001, 137].includes(_chainId)

            // Encode signature in ZeroDev format
            const encodedSignature = encodeAbiParameters(
                [
                    { name: 'authenticatorData', type: 'bytes' },
                    { name: 'clientDataJSON', type: 'string' },
                    { name: 'responseTypeLocation', type: 'uint256' },
                    { name: 'r', type: 'uint256' },
                    { name: 's', type: 'uint256' },
                    { name: 'usePrecompiled', type: 'bool' },
                ],
                [
                    authenticatorDataHex,
                    clientDataJSON,
                    beforeType,
                    r, // already bigint from parseAndNormalizeSigNoble
                    s, // already bigint from parseAndNormalizeSigNoble
                    isRIP7212Supported,
                ]
            )

            return encodedSignature
        }
    }

    // Parse DER-encoded ECDSA signature using @noble/curves (exactly like ZeroDev)
    const parseAndNormalizeSigNoble = (derSig: Hex): { r: bigint; s: bigint } => {
        const sigWithoutPrefix = derSig.startsWith('0x') ? derSig.slice(2) : derSig
        const parsedSignature = p256.Signature.fromDER(sigWithoutPrefix)
        const compactHex = parsedSignature.toCompactHex()
        const bSig = hexToBytes(`0x${compactHex}`)
        const bR = bSig.slice(0, 32)
        const bS = bSig.slice(32)

        // Avoid malleability. Ensure low S (<= N/2 where N is the curve order)
        const r = bytesToBigInt(bR)
        let s = bytesToBigInt(bS)
        const n = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551')
        if (s > n / 2n) {
            s = n - s
        }
        return { r, s }
    }

    // Parse DER-encoded ECDSA signature to r,s values (manual fallback - kept for reference)
    // Based on ZeroDev's parseAndNormalizeSig function
    const parseAndNormalizeSig = (signatureHex: string): { r: string; s: string } => {
        const sig = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex
        const bytes = new Uint8Array(sig.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))

        // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
        if (bytes[0] !== 0x30) {
            throw new Error('Invalid DER signature')
        }

        let offset = 2 // Skip 0x30 and length byte

        // Read r
        if (bytes[offset] !== 0x02) {
            throw new Error('Invalid DER signature: expected 0x02 for r')
        }
        offset++
        const rLength = bytes[offset]
        offset++
        let r = bytes.slice(offset, offset + rLength)
        offset += rLength

        // Read s
        if (bytes[offset] !== 0x02) {
            throw new Error('Invalid DER signature: expected 0x02 for s')
        }
        offset++
        const sLength = bytes[offset]
        offset++
        let s = bytes.slice(offset, offset + sLength)

        // Remove leading zeros if r or s is 33 bytes (leading 0x00 for positive number)
        if (r.length === 33 && r[0] === 0) {
            r = r.slice(1)
        }
        if (s.length === 33 && s[0] === 0) {
            s = s.slice(1)
        }

        // Pad to 32 bytes if needed
        const padTo32 = (arr: Uint8Array): Uint8Array => {
            if (arr.length === 32) return arr
            if (arr.length > 32) return new Uint8Array(arr.slice(arr.length - 32))
            const padded = new Uint8Array(32)
            padded.set(arr, 32 - arr.length)
            return padded
        }

        const rPadded = padTo32(r)
        let sPadded = padTo32(s)

        // Normalize s (if s > n/2, use n - s) for malleability fix
        // secp256r1 curve order n
        const n = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551')
        const halfN = n / BigInt(2)
        let sInt = BigInt('0x' + Array.from(sPadded).map(b => b.toString(16).padStart(2, '0')).join(''))

        if (sInt > halfN) {
            sInt = n - sInt
            const sHex = sInt.toString(16).padStart(64, '0')
            sPadded = new Uint8Array(sHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
        }

        return {
            r: '0x' + Array.from(rPadded).map(b => b.toString(16).padStart(2, '0')).join(''),
            s: '0x' + Array.from(sPadded).map(b => b.toString(16).padStart(2, '0')).join(''),
        }
    }

    // Test passkey creation using the native plugin
    const testNativePasskeyCreation = async (rpId?: string) => {
        setIsLoading(true)
        setError(null)
        setTestResult(null)

        try {
            const { Webauthn } = await import('capacitor-webauthn')

            // Generate random challenge and user ID
            const challenge = new Uint8Array(32)
            crypto.getRandomValues(challenge)

            const userId = new Uint8Array(16)
            crypto.getRandomValues(userId)

            // Build options - rpId is optional, if not provided Android may use package name
            const options: any = {
                challenge: bufferToBase64URL(challenge.buffer),
                rp: {
                    name: 'Peanut PoC Test',
                },
                user: {
                    id: bufferToBase64URL(userId.buffer),
                    name: `test-user-${Date.now()}`,
                    displayName: 'Test User',
                },
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' },   // ES256
                    { alg: -257, type: 'public-key' }, // RS256
                ],
                authenticatorSelection: {
                    userVerification: 'required',
                    residentKey: 'preferred',
                },
                timeout: 60000,
                attestation: 'none',
            }

            // Only add rpId if specified
            if (rpId) {
                options.rp.id = rpId
            }

            setTestResult(`Calling native startRegistration()...\nRP ID: ${rpId || '(not set - using default)'}`)

            const credential = await Webauthn.startRegistration(options)

            if (credential && credential.id) {
                const effectiveRpId = rpId || window.location.hostname

                // Store credential for signing test
                setStoredCredential({
                    id: credential.id,
                    rawId: credential.rawId,
                    rpId: effectiveRpId,
                    publicKey: credential.response?.publicKey,
                })

                // Try to parse the public key and create WebAuthnKey for ZeroDev
                if (credential.response?.publicKey) {
                    try {
                        const parsedKey = await parsePublicKeyToWebAuthnKey(
                            credential.response.publicKey,
                            credential.id,
                            effectiveRpId
                        )
                        // Add the native signing callback so ZeroDev uses native plugin instead of browser WebAuthn
                        parsedKey.signMessageCallback = createNativeSignMessageCallback(effectiveRpId)
                        setWebAuthnKey(parsedKey)
                        setTestResult(`✅ SUCCESS! Passkey created via native plugin.\nCredential ID: ${credential.id.slice(0, 30)}...\n\nPublic Key X: ${parsedKey.pubX.toString(16).slice(0, 20)}...\nPublic Key Y: ${parsedKey.pubY.toString(16).slice(0, 20)}...\n\n🎉 WebAuthnKey parsed with native signing! You can now test ZeroDev integration!`)
                    } catch (parseErr: any) {
                        console.error('Failed to parse public key:', parseErr)
                        setTestResult(`✅ Passkey created but failed to parse public key: ${parseErr.message}\n\nCredential ID: ${credential.id.slice(0, 30)}...`)
                    }
                } else {
                    setTestResult(`✅ SUCCESS! Passkey created via native plugin.\nCredential ID: ${credential.id.slice(0, 30)}...\n\n⚠️ No public key in response - cannot use with ZeroDev directly`)
                }
            } else {
                setTestResult('❌ Credential creation returned empty result')
            }
        } catch (err: any) {
            console.error('Native passkey creation failed:', err)
            setError(err.message || 'Unknown error')
            setTestResult(`❌ FAILED: ${err.name || 'Error'} - ${err.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    // Test signing with the stored credential
    const testNativePasskeySigning = async () => {
        if (!storedCredential) {
            setError('No credential stored. Create a passkey first!')
            return
        }

        setIsLoading(true)
        setError(null)
        setTestResult(null)

        try {
            const { Webauthn } = await import('capacitor-webauthn')

            // Generate a challenge to sign (simulating a transaction hash)
            const challenge = new Uint8Array(32)
            crypto.getRandomValues(challenge)

            const options = {
                challenge: bufferToBase64URL(challenge.buffer),
                rpId: storedCredential.rpId,
                allowCredentials: [{
                    id: storedCredential.id,
                    type: 'public-key' as const,
                }],
                userVerification: 'required' as const,
                timeout: 60000,
            }

            setTestResult(`Signing challenge with passkey...\nRP ID: ${storedCredential.rpId}\nCredential: ${storedCredential.id.slice(0, 20)}...`)

            const assertion = await Webauthn.startAuthentication(options)

            if (assertion && assertion.response) {
                setTestResult(`✅ SIGNING SUCCESS!\n\nSignature (first 50 chars): ${assertion.response.signature.slice(0, 50)}...\n\nAuthenticator Data: ${assertion.response.authenticatorData.slice(0, 30)}...\n\nThis proves the passkey can sign data for ZeroDev transactions!`)
            } else {
                setTestResult('❌ Authentication returned empty result')
            }
        } catch (err: any) {
            console.error('Native passkey signing failed:', err)
            setError(err.message || 'Unknown error')
            setTestResult(`❌ SIGNING FAILED: ${err.name || 'Error'} - ${err.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    // Test actual ZeroDev transaction - sends 0 ETH to self
    const testZeroDevTransaction = async () => {
        if (!webAuthnKey) {
            setError('No WebAuthnKey available. Create a passkey first!')
            return
        }

        setIsLoading(true)
        setError(null)
        setTestResult(null)

        try {
            setTestResult('Creating ZeroDev kernel account...')

            // Create public client for Arbitrum
            const publicClient = createPublicClient({
                chain: arbitrum,
                transport: http(),
            })

            // Create passkey validator from our WebAuthnKey
            const passkeyValidator = await toPasskeyValidator(publicClient, {
                webAuthnKey,
                entryPoint: USER_OP_ENTRY_POINT,
                kernelVersion: ZERODEV_KERNEL_VERSION,
                validatorContractVersion: PasskeyValidatorContractVersion.V0_0_3_PATCHED,
            })

            setTestResult('Creating kernel account...')

            // Create kernel account
            const kernelAccount = await createKernelAccount(publicClient, {
                plugins: {
                    sudo: passkeyValidator,
                },
                entryPoint: USER_OP_ENTRY_POINT,
                kernelVersion: ZERODEV_KERNEL_VERSION,
            })

            const accountAddress = kernelAccount.address
            setSmartAccountAddress(accountAddress)

            setTestResult(`Smart Account Address: ${accountAddress}\n\nCreating kernel client...`)

            // Create kernel client with paymaster
            const kernelClient = createKernelAccountClient({
                account: kernelAccount,
                chain: arbitrum,
                bundlerTransport: http(BUNDLER_URL),
                paymaster: {
                    getPaymasterData: async (userOperation) => {
                        const zerodevPaymaster = createZeroDevPaymasterClient({
                            chain: arbitrum,
                            transport: http(PAYMASTER_URL),
                        })
                        return await zerodevPaymaster.sponsorUserOperation({
                            userOperation,
                            shouldOverrideFee: true,
                        })
                    },
                },
            })

            setTestResult(`Smart Account: ${accountAddress}\n\nSending test transaction (0 ETH to self)...\n\n🔐 A passkey prompt should appear!`)

            // Send a 0-value transaction to self (cheapest possible test)
            const userOpHash = await kernelClient.sendUserOperation({
                callData: await kernelAccount.encodeCalls([
                    {
                        to: accountAddress,
                        value: BigInt(0),
                        data: '0x',
                    },
                ]),
            })

            setTestResult(`Smart Account: ${accountAddress}\n\nUserOp Hash: ${userOpHash}\n\nWaiting for transaction receipt...`)

            // Wait for the transaction
            const receipt = await kernelClient.waitForUserOperationReceipt({
                hash: userOpHash,
            })

            const txHash = receipt.receipt.transactionHash
            const arbiscanUrl = `https://arbiscan.io/tx/${txHash}`

            setTestResult(`🎉 SUCCESS! On-chain transaction confirmed!\n\nSmart Account: ${accountAddress}\n\nUserOp Hash: ${userOpHash}\n\nTx Hash: ${txHash}\n\n🔗 View on Arbiscan:\n${arbiscanUrl}`)
        } catch (err: any) {
            console.error('ZeroDev transaction failed:', err)
            setError(err.message || 'Unknown error')
            setTestResult(`❌ ZeroDev FAILED: ${err.name || 'Error'} - ${err.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen flex-col gap-4 p-4 pb-20">
            <NavHeader title="Native PoC - WebAuthn" />

            <Card className="space-y-3 p-4">
                <h2 className="text-lg font-bold">WebAuthn Diagnostics</h2>

                {diagnostics ? (
                    <div className="space-y-1 text-xs font-mono">
                        <p><strong>PublicKeyCredential:</strong> {diagnostics.hasPublicKeyCredential ? '✅' : '❌'}</p>
                        <p><strong>navigator.credentials:</strong> {diagnostics.hasNavigatorCredentials ? '✅' : '❌'}</p>
                        <p><strong>Secure Context:</strong> {diagnostics.isSecureContext ? '✅' : '❌'}</p>
                        <p><strong>Capacitor:</strong> {diagnostics.hasCapacitor ? '✅' : '❌'}</p>
                        <p><strong>UVPA Available:</strong> {diagnostics.uvpaAvailable === null ? '?' : diagnostics.uvpaAvailable ? '✅' : '❌'}</p>
                        <p><strong>Conditional Mediation:</strong> {diagnostics.conditionalMediationAvailable === null ? '?' : diagnostics.conditionalMediationAvailable ? '✅' : '❌'}</p>
                        <p><strong>Native Plugin:</strong> {diagnostics.nativePluginAvailable === null ? '?' : diagnostics.nativePluginAvailable ? '✅' : '❌'}</p>
                        <p><strong>Hostname:</strong> {diagnostics.hostname}</p>
                        <p><strong>Protocol:</strong> {diagnostics.protocol}</p>
                        <p className="break-all"><strong>UA:</strong> {diagnostics.userAgent.slice(0, 100)}...</p>
                    </div>
                ) : (
                    <p className="text-sm">Loading diagnostics...</p>
                )}
            </Card>

            <Card className="space-y-3 p-4">
                <h2 className="text-lg font-bold">Test Results</h2>

                {testResult && (
                    <div className={`rounded p-2 text-sm break-all ${testResult.includes('✅') ? 'bg-green-100' : testResult.includes('❌') ? 'bg-red-100' : 'bg-yellow-100'}`}>
                        {testResult}
                    </div>
                )}

                {error && (
                    <div className="rounded bg-red-100 p-2 text-sm text-red-700 break-all">
                        <strong>Error:</strong> {error}
                    </div>
                )}
            </Card>

            <div className="space-y-2">
                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={testRawWebAuthn}
                    disabled={isLoading}
                    loading={isLoading}
                    className="w-full"
                >
                    Test Raw WebAuthn API
                </Button>

                <Button
                    variant="dark"
                    shadowSize="4"
                    onClick={testNativePlugin}
                    disabled={isLoading}
                    loading={isLoading}
                    className="w-full"
                >
                    Test Native Plugin Available
                </Button>

                <Button
                    variant="yellow"
                    shadowSize="4"
                    onClick={() => testNativePasskeyCreation()}
                    disabled={isLoading}
                    loading={isLoading}
                    className="w-full"
                >
                    🔑 Create Passkey (no rpId)
                </Button>

                <Button
                    variant="stroke"
                    shadowSize="4"
                    onClick={() => testNativePasskeyCreation('peanut.me')}
                    disabled={isLoading}
                    loading={isLoading}
                    className="w-full"
                >
                    🔑 Create Passkey (peanut.me)
                </Button>

                <Button
                    variant="stroke"
                    shadowSize="4"
                    onClick={() => testNativePasskeyCreation('localhost')}
                    disabled={isLoading}
                    loading={isLoading}
                    className="w-full"
                >
                    🔑 Create Passkey (localhost)
                </Button>

                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={() => testNativePasskeyCreation('3ff1-146-70-189-102.ngrok-free.app')}
                    disabled={isLoading}
                    loading={isLoading}
                    className="w-full"
                >
                    🔑 Create Passkey (ngrok)
                </Button>

                {storedCredential && (
                    <Button
                        variant="yellow"
                        shadowSize="4"
                        onClick={testNativePasskeySigning}
                        disabled={isLoading}
                        loading={isLoading}
                        className="w-full"
                    >
                        ✍️ Sign Challenge (WebAuthn Test)
                    </Button>
                )}

                {webAuthnKey && (
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={testZeroDevTransaction}
                        disabled={isLoading}
                        loading={isLoading}
                        className="w-full"
                    >
                        🚀 Send ZeroDev Transaction (On-Chain!)
                    </Button>
                )}
            </div>

            {smartAccountAddress && (
                <Card className="bg-purple-50 p-4">
                    <p className="text-sm font-bold">Smart Account Address:</p>
                    <p className="break-all text-xs font-mono mt-1">{smartAccountAddress}</p>
                </Card>
            )}

            <Card className="bg-blue-50 p-4 text-xs">
                <p className="font-bold">What this tests:</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                    <li><strong>Raw WebAuthn:</strong> Tests if browser API works directly (will fail in WebView)</li>
                    <li><strong>Native Plugin Available:</strong> Checks if capacitor-webauthn plugin is working</li>
                    <li><strong>Create Passkey (Native):</strong> Creates passkey using native Android APIs and extracts public key</li>
                    <li><strong>Sign Challenge:</strong> Tests WebAuthn signing (not on-chain)</li>
                    <li><strong>ZeroDev Transaction:</strong> Creates ERC-4337 smart account and sends REAL on-chain transaction!</li>
                </ul>
                <p className="mt-2 text-gray-600">
                    The ZeroDev test will prompt for passkey signature and submit a UserOperation to Arbitrum.
                </p>
            </Card>
        </div>
    )
}
