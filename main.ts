// BLOOMWARDEN's hand-in program (Node 22, standard library only). It copies the
// game (game/) and its screenshots (screenshots/) from this repository into the
// output directory, then writes the dossier the judge reads with the kit's own
// library — so the dossier is byte for byte what the scorer rebuilds from the
// same files.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start clean, so a stale file from an earlier run never leaks into this hand-in.
mkdirSync(outputDir, { recursive: true });
for (const name of ['game', 'screenshots', 'dossier.json']) {
  const target = join(outputDir, name);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): text_max_bytes shapes the dossier's
// bytes; the rest refuse an entry the scorer would refuse (too many or too large
// screenshots, too many or too large game files, a path under game/ overlong).
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
