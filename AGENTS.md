# WebXR Lab — agent operating rules

## Purpose

This repository is a deliberately small WebXR research lab. Its current job is to establish physical-headset evidence before architecture expands.

## Current authority

- `main` is the live experiment branch.
- `docs/F0_GATE.md` defines the active acceptance gate.
- A desktop render/build is supporting evidence only.
- Physical Meta Quest evidence is required before claiming F0 PASS.

## F0 boundaries

Keep F0 focused on:

- hosted HTTPS WebXR;
- immersive VR session lifecycle;
- headset tracking;
- Touch controller target-ray + grip tracking;
- trigger input;
- one small spatial shooting loop;
- visible in-world hit/progress feedback.

Do not introduce locomotion, a physics engine, hand tracking, passthrough, GLTF assets, multiplayer, backend infrastructure, or donor code merely because they may be useful later.

## Engineering discipline

- Prefer the smallest change that improves the active evidence question.
- Feature-detect WebXR at runtime; do not user-agent sniff.
- Keep target-ray and grip spaces semantically distinct.
- Preserve a desktop fallback for cheap non-XR validation, but never treat it as headset proof.
- Record hardware failures before tuning around them.
- Do not turn current Three.js/Vite choices into permanent architecture claims.
- Avoid copying architecture from other Jozz projects without an explicit donor decision.

## Hosting target

F0 targets Cloudflare Pages with `npm run build` and `dist` output. Hosting is transport, not part of gameplay architecture.
