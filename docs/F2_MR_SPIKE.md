# F2 — Mixed Reality Reactor spike

## Why this exists

F0 proved hosted WebXR on physical Quest 2. F1-A4 on `main` is the active VR gameplay gate and remains frozen until its heavier physics / grab loop is tested on hardware.

F2 is therefore isolated on `f2-mr-spike`. It must not silently change the production root or become a reason to skip F1 evidence.

The F2 research question is:

> Can the same WebXR lab place a coherent Reactor interaction into the Owner's real room using Quest 2 passthrough while preserving stable spatial placement and deliberate Touch-controller interaction?

## Evidence basis

Meta Quest Browser documents WebXR `immersive-ar` passthrough on Quest 2. Quest 2 passthrough is grayscale. Plane detection and anchors are also supported, but they are separate spatial-data capabilities and are deliberately staged after the baseline passthrough proof.

All capabilities must be feature-detected at runtime. Do not infer support from the user agent.

## Active gate — B1 passthrough baseline

Active entrypoint: `mr.html` → `src/mr-passthrough.js`.

B1 deliberately requests only:

- `immersive-ar`;
- required `local-floor` reference space.

It does **not** request plane detection, anchors, room capture, hand tracking or scene understanding. This keeps the first test independent from spatial-data permissions and room-setup state.

B1 PASS requires a physical Quest 2 run showing:

1. the browser reports `immersive-ar` support;
2. `START MR` enters an actual immersive AR session, with no fallback to immersive VR;
3. passthrough is visible behind transparent WebGL content;
4. `local-floor` produces a believable floor-relative hologram height;
5. head tracking remains correct;
6. at least one Touch controller target ray tracks correctly;
7. trigger input deliberately hits a virtual target;
8. the reactor / target field remains spatially stable for a short continuous run;
9. leaving MR returns to the 2D page cleanly.

## Why B1 owns the session bootstrap

The first P0 prototype used Three.js `ARButton`. Source review of Three r186 found that `ARButton` explicitly switches the renderer to `local` reference space when the AR session starts. That would invalidate our floor-height evidence even if passthrough itself worked.

The active B1 runtime therefore owns `navigator.xr.requestSession('immersive-ar', ...)` directly, requires `local-floor`, sets the renderer reference-space type before `setSession`, and has no VR fallback.

## Staged follow-up gates

### P2 — plane detection

Only after B1 passthrough PASS:

- request `plane-detection` explicitly;
- observe whether spatial-data permission / room setup is already available;
- wait for actual plane evidence before drawing conclusions;
- visualize detected surfaces only when the runtime genuinely exposes them.

Plane detection is a separate evidence question because requesting it can invoke access to space-setup information.

### P3 — anchors

Only after useful plane / spatial placement evidence:

- test anchor creation and stability;
- separate short-session anchor stability from persistence across sessions;
- do not make anchors a hidden dependency of ordinary passthrough gameplay.

## Deliberate boundaries

Until B1 is proven, keep out:

- hand tracking as the primary input;
- room mesh / scene reconstruction assumptions;
- plane detection and room-capture requests;
- anchors;
- full F1 Rapier migration;
- artificial locomotion;
- imported art assets;
- any change to the live F1 root on `main`.

## Current implementation

B1 uses:

- a separate `mr.html` Vite entrypoint;
- custom `immersive-ar` session bootstrap;
- `WebGLRenderer({ alpha: true })`;
- transparent scene / alpha-zero clear;
- required `local-floor`;
- the target-ray / `selectstart` interaction model already proven by F0;
- a small holographic reactor approximately 1.8 m in front of the player;
- six virtual targets, controller rays and trigger-driven hit feedback;
- no Rapier or room-data dependency.

The branch is intentionally kept as a draft research spike and should not be merged into `main` before the active F1 hardware gate is resolved.
