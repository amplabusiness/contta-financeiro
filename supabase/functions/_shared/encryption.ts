/**
 * Encryption utilities for sensitive data
 */

const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required')
}

const encryptionKey = ENCRYPTION_KEY

export async function encrypt(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(encryptionKey.slice(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

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
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(encryptionKey.slice(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )

  return decoder.decode(decrypted)
}
