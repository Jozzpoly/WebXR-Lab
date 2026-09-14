# WebXR Lab

A small, evidence-driven laboratory for testing real WebXR experiences on Meta Quest hardware.

## Current objective

Prove the smallest complete vertical slice on a physical headset:

**hosted HTTPS page → immersive VR → headset tracking → two controllers → trigger input → spatial interaction → simple playable loop**

The first milestone is intentionally narrow. This repository is not yet a game engine, a JV fork, or a production VR architecture.

## Live state

**F0-Q1 pre-headset candidate implemented; clean Cloudflare build/deploy PASS; public desktop load PASS; physical Quest evidence not yet collected.**

Public build:

`https://webxr-lab.jozzpoly.workers.dev/`

Current source includes:

- runtime secure-context / WebXR / `immersive-vr` diagnostics;
- explicit F0-Q1 build identity in the page UI;
- per-session XR trigger/select event counting;
- truthful left/right controller readiness diagnostics;
- a small standing target-range scene with no artificial locomotion;
- separate XR target-ray and grip spaces for two controllers;
- trigger-driven shots using the controller target ray;
- visible projectiles, target hit feedback and in-world progress pips;
- optional controller haptics when exposed by the runtime;
- automatic round reset after all eight targets are cleared;
- desktop click-to-hit fallback for cheap non-XR validation;
- explicit session-end cleanup so diagnostics do not remain falsely `active` after leaving XR.

On 2026-09-14 Cloudflare successfully cloned the repository, installed dependencies in a clean build environment, ran `npm run build`, and completed `npx wrangler deploy` for the assets-only Worker. The resulting HTTPS page also rendered correctly in the Owner's desktop browser. Desktop `immersive-vr: not supported` is expected on a non-XR browser and is not a headset result.

The physical Quest 2 run remains the authority gate for F0.

## Working principles

- Prefer the smallest experiment that can change a decision.
- Keep headset evidence separate from desktop/browser validation.
- Do not claim Quest support until it has been tested on the actual headset.
- Keep optional future directions (IWSDK, physics, hand tracking, MR, donor code) out of the F0 critical path.
- Preserve negative evidence instead of tuning failures away.

## F0 gate

The exact active acceptance contract and first hardware test protocol are in [`docs/F0_GATE.md`](docs/F0_GATE.md).

F0 passes only when the Owner can open the hosted URL in Quest Browser, enter immersive VR, see tracked controllers, aim with a controller, fire with the trigger, hit spatial targets, receive immediate feedback, and complete a short repeatable round.

## Stack for F0

- Node 22.16.0
- Vite 8.3.0
- Three.js 0.186.0
- native WebXR through Three.js helpers
- static hosting: Cloudflare Workers Static Assets

No backend or Worker script is required.

## Cloudflare deployment

The repository includes `wrangler.jsonc` configured as an assets-only Worker serving `./dist`.

Use the Git integration defaults:

- project name: `webxr-lab`
- build command: `npm run build`
- deploy command: `npx wrangler deploy`
- production branch: `main`

The repo pins Node through `.node-version`; no environment variables are required for F0.
