import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const skins = ['green', 'blue', 'red', 'yellow', 'purple', 'orange', 'cyan', 'pink', 'ivory', 'slate'];

/** Keep bootstrap art outside the game packs so it appears before the engine loads. */
export function writeSplashShell({ project, site }) {
  const file = join(site, 'index.html');
  let html = readFileSync(file, 'utf8');
  const launch = /    <div id="launch"[^>]*>[\s\S]*?<\/div>(?=\s*<script\b)/;
  if (!launch.test(html)) throw new Error('Pinned engine shell changed: could not locate launch screen.');
  html = html.replace(launch, readFileSync(join(project, 'web/splash.html'), 'utf8').trimEnd());
  html = html.replace('<title>Game Engine</title>', '<title>Bubble Madness</title>');
  html = html.replace('</head>', '    <link rel="preload" href="./splash/arcade.ttf" as="font" type="font/ttf" crossorigin />\n    <link rel="stylesheet" href="./splash/splash.css" />\n  </head>');
  const assets = join(site, 'splash');
  mkdirSync(assets, { recursive: true });
  copyFileSync(join(project, 'web/splash.css'), join(assets, 'splash.css'));
  copyFileSync(join(project, 'web/splash/logo.webp'), join(assets, 'logo.webp'));
  copyFileSync(join(project, 'assets/reference/arcade.ttf'), join(assets, 'arcade.ttf'));
  for (const skin of skins) copyFileSync(join(project, `assets/ui/dragon-results/${skin}.png`), join(assets, `${skin}.png`));
  writeFileSync(file, html);
}
