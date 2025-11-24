/**
 * Encryption utilities for sensitive data
 */

const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required')
}

if (ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters long')
}

// Type assertion after validation
const validatedKey: string = ENCRYPTION_KEY

async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const salt = encoder.encode('ampla-contabilidade-salt-v1')
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)

  const key = await deriveKey(validatedKey)

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)

  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(encryptedText: string): Promise<string> {
  const decoder = new TextDecoder()

  const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)

  const key = await deriveKey(validatedKey)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )

  return decoder.decode(decrypted)
}
