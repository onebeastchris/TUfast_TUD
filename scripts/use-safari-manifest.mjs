import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Safari variant of the Chrome manifest, generated so the two cannot drift apart. Safari has no chrome.system.cpu.
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')
const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.chrome.json'), 'utf8'))

if (!manifest.permissions?.includes('system.cpu')) {
  throw new Error('manifest.chrome.json no longer requests system.cpu; update scripts/use-safari-manifest.mjs')
}
manifest.permissions = manifest.permissions.filter((permission) => permission !== 'system.cpu')
// Safari's extension service worker can get stuck in "activating" and never receive messages; use an event page instead.
manifest.background = { scripts: ['background.js'], type: 'module', persistent: false }

fs.writeFileSync(path.join(srcDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
