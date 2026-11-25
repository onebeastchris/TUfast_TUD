// Temporary Safari debugging page: open <extension origin>/freshContent/diagnostics/index.html. Never prints secrets.
import { userDataExists } from '../../modules/credentials'
import { isFirefox } from '../../modules/firefoxCheck'

const out = document.getElementById('out') as HTMLPreElement
const log = (line: string) => {
  out.textContent += line + '\n'
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms))
  ])
}

function sendMessage(message: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime.lastError
      if (lastError) reject(new Error(lastError.message))
      else resolve(response)
    })
  })
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function cryptoKeyInIndexedDb() {
  const open = indexedDB.open('tufast-diagnostics', 1)
  open.onupgradeneeded = () => open.result.createObjectStore('s')
  const db = await idbRequest(open)
  try {
    const store = () => db.transaction('s', 'readwrite').objectStore('s')
    await idbRequest(store().put('plain', 'text'))
    const text = await idbRequest(store().get('text'))
    const key = await crypto.subtle.generateKey({ name: 'AES-CBC', length: 256 }, false, ['encrypt', 'decrypt'])
    await idbRequest(store().put(key, 'key'))
    const back = (await idbRequest(store().get('key'))) as CryptoKey
    return `plain value ${text === 'plain' ? 'ok' : 'WRONG'}, CryptoKey ${Object.prototype.toString.call(back)} extractable=${back.extractable}`
  } finally {
    db.close()
    indexedDB.deleteDatabase('tufast-diagnostics')
  }
}

async function step(name: string, run: () => Promise<unknown>, ms = 8000) {
  const started = Date.now()
  try {
    const result = await withTimeout(run(), ms)
    log(`OK   ${name} (${Date.now() - started} ms): ${JSON.stringify(result)}`)
  } catch (err) {
    const e = err as Error
    log(`FAIL ${name} (${Date.now() - started} ms): ${e?.name}: ${e?.message}`)
  }
}

async function main() {
  log(`TUfast ${chrome.runtime.getManifest().version} diagnostics, ${new Date().toISOString()}`)
  log(`userAgent: ${navigator.userAgent}`)
  log(`origin: ${location.origin}`)
  log(
    `browser global: ${typeof globalThis.browser}, getBrowserInfo: ${typeof globalThis.browser?.runtime?.getBrowserInfo}, ` +
      `chrome.system.cpu: ${typeof chrome.system?.cpu}, isFirefox(): ${isFirefox()}, ` +
      `crypto.subtle: ${typeof crypto.subtle}, indexedDB: ${typeof indexedDB}`
  )
  log('')

  await step('storage.local readable', async () => {
    const all = await chrome.storage.local.get(null)
    return {
      keys: Object.keys(all).sort(),
      encryptionLevel: all.encryptionLevel,
      locale: all.locale,
      udataPlatforms: typeof all.udata === 'string' ? Object.keys(JSON.parse(all.udata)) : null
    }
  })
  await step('IndexedDB + CryptoKey in page', cryptoKeyInIndexedDb)
  await step('background ping (check_se_status)', () => sendMessage({ cmd: 'check_se_status' }))
  await step('background credentials (check_user_data)', () => sendMessage({ cmd: 'check_user_data', platform: 'zih' }))
  await step('background settings (check_all_settings)', () =>
    sendMessage({ cmd: 'check_all_settings', platform: 'zih' })
  )
  await step('credentials key path in page (userDataExists)', () => userDataExists('zih'))
  log('\ndone')
}

document.getElementById('copy')?.addEventListener('click', () => navigator.clipboard.writeText(out.textContent || ''))
main().catch((err) => log(`diagnostics crashed: ${err}`))
