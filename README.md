# WebXR Lab

A small, evidence-driven laboratory for testing real WebXR experiences on Meta Quest hardware.

## Current objective

Prove the smallest complete vertical slice on a physical headset:

**hosted HTTPS page → immersive VR → headset tracking → two controllers → trigger input → spatial interaction → simple playable loop**

The first milestone is intentionally narrow. This repository is not yet a game engine, a JV fork, or a production VR architecture.

## Working principles

- Prefer the smallest experiment that can change a decision.
- Keep headset evidence separate from desktop/browser validation.
- Do not claim Quest support until it has been tested on the actual headset.
- Keep optional future directions (IWSDK, physics, hand tracking, MR, donor code) out of the F0 critical path.
- Preserve negative evidence instead of tuning failures away.

## Planned F0 gate

F0 passes only when the Owner can open the hosted URL in Quest Browser, enter immersive VR, see tracked controllers, aim with a controller, fire with the trigger, hit spatial targets, receive immediate feedback, and complete a short repeatable round.

## Stack for F0

- Vite
- Three.js
- native WebXR through Three.js helpers
- static hosting (target: Cloudflare Pages)

No backend is required.
