export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function storageKey(memberId: string): string {
  return `porksoup_edit_unlock:${memberId}`
}

export function getStoredUnlockHash(memberId: string): string | null {
  return localStorage.getItem(storageKey(memberId))
}

export function setStoredUnlockHash(memberId: string, hash: string): void {
  localStorage.setItem(storageKey(memberId), hash)
}

export function clearStoredUnlockHash(memberId: string): void {
  localStorage.removeItem(storageKey(memberId))
}
