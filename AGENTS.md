# WebXR Lab — agent operating rules

## Purpose

This repository is a deliberately focused WebXR research/gameplay lab. F0 already proved the core hosted WebXR path on physical Quest 2. The active job is now to build richer VR interaction while preserving evidence discipline.

## Current authority

- `main` is the live experiment branch.
- `docs/F0_GATE.md` records the closed F0 hardware baseline.
- `docs/F1_REACTOR_DEFENSE.md` defines the active milestone.
- Desktop/build evidence is necessary but not sufficient for XR behavior.
- Physical Meta Quest behavior remains the authority for controller feel, comfort and immersive runtime correctness.

## F1 focus

Current F1 may include:

- hosted HTTPS WebXR;
- immersive VR session lifecycle;
- Touch target-ray and grip tracking;
- trigger-driven dual blasters;
- Rapier 3D rigid-body physics;
- squeeze grab/release throw interaction;
- a small coherent enemy/wave loop;
- immediate visual/haptic/audio feedback where it supports play.

Do not add locomotion, hand tracking, passthrough/MR, multiplayer/backend, an asset pipeline, or donor code merely because they are interesting. They need a concrete evidence or gameplay reason after the current loop is stable.

## Engineering discipline

- Prefer the smallest change that materially improves the active playable experiment.
- Feature-detect WebXR at runtime; do not user-agent sniff.
- Keep target-ray and grip spaces semantically distinct.
- Preserve a cheap desktop fallback for non-XR regressions, but never treat it as headset proof.
- Record hardware failures before tuning around them.
- Keep optional feedback such as haptics from being able to break primary interaction.
- Keep physics on a stable fixed timestep rather than render-delta stepping.
- Do not turn current Three.js/Vite/Rapier choices into permanent architecture claims.
- Avoid copying architecture from other Jozz projects without an explicit donor decision.

## Hosting

The public build is delivered through Cloudflare Workers Static Assets. The repo builds with `npm run build`, deploys with `npx wrangler deploy`, and serves `./dist`. Hosting is transport, not gameplay architecture.
