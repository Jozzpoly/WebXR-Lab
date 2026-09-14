# WebXR Lab

An evidence-driven laboratory for building and testing real WebXR experiences on Meta Quest hardware.

Public build:

`https://webxr-lab.jozzpoly.workers.dev/`

## Live state

**F0 physical Quest 2 gate: PASS.**

On 2026-09-14 the hosted build was opened in Meta Quest Browser on a physical Quest 2. The Owner confirmed that immersive VR started, head tracking worked, a Touch controller tracked the hand, trigger input fired, and a deliberate spatial target hit succeeded. The test was brief, so F0 is evidence for the core WebXR path rather than a broad compatibility/performance certification.

**F1-A4 Reactor Defense: clean production build PASS; physical Quest 2 behavior not yet proven.**

A3 established the richer playable runtime. A4 is a focused reliability layer over that runtime: grab/release physics now falls back to locally estimated throw velocity when WebXR does not expose usable controller velocity, and a lightweight diagnostics row records grab/release counts plus whether native or fallback throw velocity was used.

Active browser entrypoint:

`index.html` → `src/reactor-defense.js` + `src/telemetry-overlay.js`

## Current objective — F1 Reactor Defense

The active candidate expands the proven WebXR foundation with:

- pinned Rapier 3D physics;
- physical crates and energy orbs;
- controller `squeeze` grab / release throw interaction;
- native controller throw velocity when available, with bounded local motion-estimation fallback;
- dual trigger-driven blasters;
- physics impulses from weapon hits;
- lightweight hostile drone behavior;
- enemy projectiles and reactor health;
- a short three-wave loop with an elite final target;
- thrown-object damage against drones;
- positional synthesized audio and haptics as optional feedback;
- post-session grab/throw diagnostics;
- procedural geometry only, keeping runtime asset dependencies near zero.

The detailed active contract is in [`docs/F1_REACTOR_DEFENSE.md`](docs/F1_REACTOR_DEFENSE.md).

## Evidence baseline

### F0 — PASS

Demonstrated on physical Quest 2:

**hosted HTTPS page → immersive VR → headset tracking → Touch controller tracking → trigger input → deliberate spatial interaction**

The original gate and limitations remain documented in [`docs/F0_GATE.md`](docs/F0_GATE.md).

### F1 — in progress

Current production candidate: **F1-A4**.

CI has built the A4 production bundle successfully. The next authority gate is a physical Quest run proving that the heavier stack does not regress F0 and that Rapier physics plus squeeze grab/release throw are genuinely usable in VR.

## Working principles

- Prefer experiments that can change a decision.
- Keep desktop/browser validation separate from headset evidence.
- Physical Meta Quest behavior remains authority for XR interaction.
- Preserve negative evidence instead of tuning failures away.
- Do not turn current Three.js/Vite/Rapier choices into permanent engine architecture claims.
- Add ambitious systems only when they form one coherent playable loop rather than a feature checklist.
- Keep one clear active browser entrypoint; historical candidates belong in Git history, not as misleading duplicate source files.

## Current stack

- Node 22.16.0
- Vite 8.3.0
- Three.js 0.186.0
- native WebXR through Three.js helpers
- Rapier 3D compat 0.20.0 for F1 physics
- static hosting: Cloudflare Workers Static Assets

No backend or Worker script is required.

## Validation

Every push to `main` runs a small independent GitHub Actions production build gate in addition to Cloudflare deployment. Build success remains supporting evidence only; physical Quest behavior is the authority for immersive interaction.

## Cloudflare deployment

The repository includes `wrangler.jsonc` configured as an assets-only Worker serving `./dist`.

Git integration:

- project name: `webxr-lab`
- build command: `npm run build`
- deploy command: `npx wrangler deploy`
- production branch: `main`

The repo pins Node through `.node-version`; no environment variables are required.
