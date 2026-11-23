import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Safari has no chrome.system.cpu; everything else follows the Chrome manifest so the two cannot drift apart.
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')
const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.chrome.json'), 'utf8'))

if (!manifest.permissions?.includes('system.cpu')) {
  throw new Error('manifest.chrome.json no longer requests system.cpu; update scripts/use-safari-manifest.mjs')
}
manifest.permissions = manifest.permissions.filter((permission) => permission !== 'system.cpu')

fs.writeFileSync(path.join(srcDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
