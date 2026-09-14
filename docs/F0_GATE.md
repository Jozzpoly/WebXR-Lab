# F0 — physical Quest presence gate

## Question

Can this repository produce a small but genuinely playable WebXR experience in Meta Quest Browser, with no native app install and no backend?

## Required evidence

F0 is **not passed** by a successful desktop render or build.

The physical Quest test must demonstrate, in one hosted build:

1. The page loads over HTTPS in Quest Browser.
2. The page reports a secure context and `immersive-vr` support.
3. `Enter VR` starts an immersive session.
4. Head motion produces stable 6DoF view tracking at believable world scale.
5. Both Touch controllers are tracked.
6. A controller target ray follows the user's pointing direction.
7. Trigger input fires from that controller.
8. At least one spatial target can be hit deliberately.
9. Hit feedback and progress are visible in-world.
10. All eight targets can be cleared and the round resets without leaving XR.

## Validation layers

### Static / desktop

Useful for catching ordinary regressions before headset time:

- module syntax;
- scene render;
- target layout;
- desktop click-to-hit fallback;
- score/reset logic;
- WebXR feature-detection UI.

Desktop success is **supporting evidence only**.

### Physical headset

The Quest 2 run is the authority for XR behavior. Record concrete failures instead of compensating blindly. In particular watch for:

- wrong scale or player height;
- controller/ray orientation mismatch;
- trigger event failures;
- frame pacing or obvious latency;
- targets outside comfortable reach/view;
- session start/end lifecycle faults.

## Deliberately excluded from F0

- locomotion;
- grabbing/throwing;
- physics engine integration;
- hand tracking;
- passthrough / mixed reality;
- imported GLTF assets;
- audio pipeline;
- multiplayer/backend;
- JV/FrameMatter/JES code reuse;
- commitment to Three.js vs IWSDK as a long-term architecture.

These become candidates only after the vertical slice is demonstrated.

## Cloudflare Pages target

When the repository is connected to Cloudflare Pages:

- production branch: `main`
- build command: `npm run build`
- build output directory: `dist`
- root directory: repository root
- Node version: repository `.node-version`

No environment variables or backend are required for F0.
