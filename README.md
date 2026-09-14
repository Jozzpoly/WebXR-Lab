# WebXR Lab

A small, evidence-driven laboratory for testing real WebXR experiences on Meta Quest hardware.

## Current objective

Prove the smallest complete vertical slice on a physical headset:

**hosted HTTPS page → immersive VR → headset tracking → two controllers → trigger input → spatial interaction → simple playable loop**

The first milestone is intentionally narrow. This repository is not yet a game engine, a JV fork, or a production VR architecture.

## Live state

**F0 candidate implemented; physical Quest evidence not yet collected.**

Current source includes:

- runtime secure-context / WebXR / `immersive-vr` diagnostics;
- a small standing target-range scene with no artificial locomotion;
- separate XR target-ray and grip spaces for two controllers;
- trigger-driven shots using the controller target ray;
- visible projectiles, target hit feedback and in-world progress pips;
- optional controller haptics when exposed by the runtime;
- automatic round reset after all eight targets are cleared;
- desktop click-to-hit fallback for cheap non-XR validation.

JavaScript syntax has been checked independently. A production dependency install/build and the physical Quest run remain open gates; neither should be inferred from source inspection.

## Working principles

- Prefer the smallest experiment that can change a decision.
- Keep headset evidence separate from desktop/browser validation.
- Do not claim Quest support until it has been tested on the actual headset.
- Keep optional future directions (IWSDK, physics, hand tracking, MR, donor code) out of the F0 critical path.
- Preserve negative evidence instead of tuning failures away.

## F0 gate

The exact active acceptance contract is in [`docs/F0_GATE.md`](docs/F0_GATE.md).

F0 passes only when the Owner can open the hosted URL in Quest Browser, enter immersive VR, see tracked controllers, aim with a controller, fire with the trigger, hit spatial targets, receive immediate feedback, and complete a short repeatable round.

## Stack for F0

- Node 22.16.0
- Vite 8.3.0
- Three.js 0.186.0
- native WebXR through Three.js helpers
- static hosting target: Cloudflare Pages

No backend is required.

## Cloudflare Pages

Use:

- production branch: `main`
- build command: `npm run build`
- output directory: `dist`
- root directory: repository root

The repo pins Node through `.node-version`; no environment variables are required for F0.
