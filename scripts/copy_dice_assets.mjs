import { cp, mkdir } from 'node:fs/promises';
// Build-owned static assets: no dependency postinstall scripts and no CDN at runtime.
await mkdir(new URL('../public/dice-assets/', import.meta.url), { recursive: true });
await cp(new URL('../node_modules/@3d-dice/dice-box/dist/assets/', import.meta.url), new URL('../public/dice-assets/', import.meta.url), { recursive: true });
await cp(new URL('../node_modules/@3d-dice/dice-box/LICENSE', import.meta.url), new URL('../public/dice-assets/LICENSE', import.meta.url));
