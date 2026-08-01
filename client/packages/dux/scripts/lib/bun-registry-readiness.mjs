/**
 * Probe Bun's actual npm-alias installer for a just-published package version.
 *
 * `bun pm view` is not sufficient: it can see a version while the installer's
 * cached package manifest still rejects that version. An isolated, cacheless
 * dry run exercises the resolver path the demo uses without changing the demo.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { succeeds } from './run-publish-step.mjs'

export function canInstallBunNpmAlias(packageName, version, { cwd, tempRoot = os.tmpdir() } = {}) {
  const probeDir = fs.mkdtempSync(path.join(tempRoot, 'idb-dux-bun-registry-probe-'))
  try {
    fs.writeFileSync(path.join(probeDir, 'package.json'), `${JSON.stringify({
      name: 'idb-dux-bun-registry-probe',
      private: true,
      dependencies: {
        [packageName]: `npm:${packageName}@${version}`,
      },
    }, null, 2)}\n`)

    return succeeds(
      'bun',
      [
        'install',
        '--cwd',
        probeDir,
        '--dry-run',
        '--force',
        '--no-cache',
        '--ignore-scripts',
      ],
      { cwd },
    )
  }
  finally {
    fs.rmSync(probeDir, { recursive: true, force: true })
  }
}
