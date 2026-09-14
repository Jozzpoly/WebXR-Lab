# F0 — physical Quest presence gate

## Result

**PASS on physical Meta Quest 2 — 2026-09-14.**

The hosted WebXR build was opened in Meta Quest Browser on a real Quest 2. In the brief hardware run the Owner confirmed:

- immersive VR started successfully;
- head motion drove the camera correctly;
- a Touch controller tracked the user's hand;
- trigger input fired;
- a deliberate spatial target hit succeeded.

This is sufficient to close the original F0 research question: the repository can deliver a genuinely interactive hosted WebXR experience to Quest 2 with no native app install and no backend.

## Scope of the evidence

The first hardware run lasted only a few seconds because the headset was needed for something else. Therefore this PASS should **not** be overstated as proof of:

- long-session stability;
- both-controller behavior over time;
- sustained performance/frame pacing;
- round reset/session-end correctness on hardware;
- haptic reliability;
- broad Quest/browser-version compatibility.

Those remain things later milestones can exercise while building actual gameplay. What F0 establishes is the critical vertical slice:

**HTTPS → Meta Quest Browser → immersive WebXR → head tracking → controller tracking → trigger → spatial interaction.**

## Original acceptance contract

The pre-test contract asked the hardware run to eventually demonstrate:

1. Hosted HTTPS load in Quest Browser.
2. Secure context and `immersive-vr` support.
3. Successful immersive session start.
4. Stable 6DoF head tracking at believable world scale.
5. Touch controller tracking.
6. Controller target-ray tracking.
7. Trigger/select input.
8. Deliberate spatial target hit.
9. Visible hit feedback.
10. Repeatable short gameplay loop.
11. Truthful session-end lifecycle.

The first short run directly proved the core items needed to answer the F0 question. The longer-tail items are carried forward as regression/quality checks rather than reasons to keep F0 open.

## Validation already established before headset test

- Cloudflare clean install/build/deploy: **PASS**
- Public HTTPS / secure-context desktop load: **PASS**
- Desktop scene render / click interaction: **PASS**
- WebXR feature-detection UI: **PASS**
- Source-level target-ray/grip semantics checked against Three.js and Meta samples.

## Historical boundaries

F0 deliberately excluded locomotion, grabbing/throwing, a physics engine, hand tracking, passthrough/MR, imported assets, multiplayer/backend and permanent engine architecture decisions.

F1 is now allowed to expand beyond those boundaries because the base WebXR transport/input risk has been retired by hardware evidence.
