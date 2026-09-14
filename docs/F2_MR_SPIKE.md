# F2 — Mixed Reality Reactor spike

## Why this exists

F0 proved hosted WebXR on physical Quest 2. F1 is the active VR gameplay gate and remains frozen on `main` until the heavier physics/grab loop is tested on hardware.

F2 is therefore developed in isolation on `f2-mr-spike`. Its job is not to replace F1 or silently change the live root experience. It asks a separate question:

> Can the same WebXR lab place a coherent Reactor Defense interaction into the Owner's real room using Quest 2 passthrough, while preserving tracked-controller aiming and a small deliberate gameplay loop?

## Evidence basis

Meta Quest Browser documents WebXR `immersive-ar` passthrough on Quest 2, plus plane detection and anchors. Quest 2 passthrough is grayscale. Three.js exposes `ARButton` for starting `immersive-ar` sessions.

F2 must feature-detect all MR capabilities at runtime. It must not infer support from the user agent.

## First MR gate

The first spike deliberately does **not** require room setup, detected planes or persistent anchors. Those are optional follow-up capabilities.

PASS requires a physical Quest 2 run showing:

1. the browser reports `immersive-ar` support;
2. entering MR reveals passthrough behind transparent WebGL content;
3. head tracking remains correct;
4. at least one Touch controller target ray tracks correctly;
5. trigger input can deliberately hit a virtual target placed in the real room;
6. the virtual reactor / target field remains spatially stable for a short continuous run;
7. leaving the session returns to the 2D page cleanly.

## Stretch evidence

If available without destabilizing the core spike:

- report whether plane detection is exposed;
- count detected planes after the session has warmed up;
- visualize plane origins/bounds only when the data is genuinely available;
- later test anchors as a separate evidence question.

Plane detection and anchors are not allowed to block the baseline passthrough gate.

## Deliberate boundaries

For the first F2 spike, keep out:

- hand tracking as the primary input;
- room-mesh reconstruction assumptions;
- persistent anchors as a required dependency;
- full F1 Rapier gameplay migration;
- artificial locomotion;
- imported art assets;
- any change to the live F1 root on `main`.

## Implementation strategy

Use a separate `mr.html` entrypoint and a small `src/mr-spike.js` runtime on this branch.

Technical baseline:

- Three.js `ARButton`;
- `WebGLRenderer({ alpha: true })`;
- transparent scene / no opaque background;
- `renderer.xr.enabled = true`;
- `local-floor` reference space when available;
- runtime `navigator.xr.isSessionSupported('immersive-ar')` diagnostics;
- optional `plane-detection` request, never required for entering MR;
- the same target-ray semantics already proven by F0.

The first MR scene should be intentionally small: a holographic reactor approximately 1.5–2 m in front of the player, a handful of colored virtual targets/drones around it, controller rays and trigger-driven hits. Its purpose is to prove passthrough composition and spatial stability before importing F1 physics.
