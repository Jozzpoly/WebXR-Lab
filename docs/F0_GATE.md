# F0 — physical Quest presence gate

## Question

Can this repository produce a small but genuinely playable WebXR experience in Meta Quest Browser, with no native app install and no backend?

## Current pre-headset state

- Public deployment: `https://webxr-lab.jozzpoly.workers.dev/`
- Cloudflare clean install/build/deploy: **PASS**
- HTTPS / secure-context desktop load: **PASS**
- Desktop scene render and feature-detection UI: **PASS**
- Desktop `immersive-vr`: unsupported as expected on a non-XR browser; this is not a headset result.
- Physical Quest 2 WebXR behavior: **NOT YET PROVEN**

The first headset candidate is visibly labelled **F0-Q1** in the page UI. Confirm that label before entering VR so cached/older deployments cannot be mistaken for the test candidate.

## Required evidence

F0 is **not passed** by a successful desktop render or build.

The physical Quest test must demonstrate, in one hosted build:

1. The page loads over HTTPS in Quest Browser.
2. The page reports a secure context and `immersive-vr` support.
3. `Enter VR` starts an immersive session.
4. Head motion produces stable 6DoF view tracking at believable world scale.
5. Both Touch controllers are tracked; diagnostics should identify left + right.
6. A controller target ray follows the user's pointing direction.
7. Trigger input fires from that controller; the diagnostic trigger/select counter increments.
8. At least one spatial target can be hit deliberately.
9. Hit feedback and progress are visible in-world.
10. All eight targets can be cleared and the round resets without leaving XR.
11. Exiting XR returns the page to a truthful non-active session state rather than leaving stale diagnostics.

## First physical test protocol

Keep the first run deliberately short and diagnostic:

1. Open the public URL in Meta Quest Browser.
2. Before entering VR, verify `WebXR Lab · F0-Q1`, `Secure context: yes`, `WebXR API: available`, and `immersive-vr: supported`.
3. Press `Enter VR`.
4. Without using artificial locomotion, look around and check whether the floor, wall, targets and world scale feel stable and believable.
5. Move both Touch controllers and verify that both visible controller markers and their rays track naturally.
6. Pull each trigger at least once. Confirm that shots originate from the expected controller/ray direction.
7. Deliberately hit one target, then clear the remaining targets if the interaction is behaving correctly.
8. Wait for the automatic round reset.
9. Exit VR normally and inspect the browser diagnostics again if useful.

If a material failure occurs, stop and report the earliest broken step rather than compensating around it. A screenshot/photo/video is useful but not required for the first run.

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
- incorrect initial facing/origin;
- controller/ray orientation mismatch;
- only one controller being recognized;
- trigger/select event failures;
- frame pacing, judder or obvious latency;
- targets outside comfortable view;
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

## Hosting

F0 is deployed through Cloudflare Workers Static Assets using the repository `wrangler.jsonc` configuration:

- build command: `npm run build`
- deploy command: `npx wrangler deploy`
- production branch: `main`
- static asset directory: `./dist`
- Node version: repository `.node-version`

No environment variables, backend, or Worker script are required for F0.
