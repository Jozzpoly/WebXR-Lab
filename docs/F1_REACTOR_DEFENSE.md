# F1 — Reactor Defense vertical slice

## Why this milestone

F0 proved the hosted WebXR pipeline on a physical Quest 2: immersive session, head tracking, Touch controller tracking, trigger input and deliberate spatial target interaction all worked.

F1 should now maximize experiential gain per hour without turning the lab into a framework project.

## Current candidate

**F1-A4** is the active physical-headset candidate.

A3 established the richer arena/gameplay runtime. A4 adds focused reliability around grab/throw and headset entry without changing the core game loop:

- Rapier grab/release uses native WebXR controller linear/angular velocity when available;
- if velocity is absent, a bounded local estimate is derived from the recent held-object trajectory;
- a lightweight post-session telemetry row records grab/release counts and whether native or fallback linear throw velocity was used;
- immersive entry is boot-gated until the async Rapier/arena setup has reached `Game: F1 arena ready`;
- obsolete A1 source duplication has been removed so `index.html` has one clear active gameplay path.

The A4 production bundle and the later boot-gate hardening have both passed independent GitHub Actions and Cloudflare Workers builds. Physical Quest behavior for F1 remains unproven.

## Async boot finding

Adversarial review found that `VRButton` was originally appended before `await PhysicsSystem.create()`. On slower hardware this created a real race: a user could theoretically enter an immersive session before Rapier initialization, controller setup, F1 session listeners and the final animation loop had finished booting.

The live entrypoint now disables the immersive button as soon as it appears and only enables it after the arena reports `Game: F1 arena ready`. A boot failure therefore leaves immersive entry disabled instead of allowing a partially initialized XR session.

This is a general project rule for future heavy WebXR stages: **do not expose actionable immersive entry before all session-critical async boot work and event wiring are complete.**

## Known endurance debt — transient WebGL resources

Source review found that F1 creates transient projectile/effect/enemy meshes with fresh Three.js geometry and/or material resources and later removes those objects from the scene without an explicit resource lifecycle. In Three.js, removing an object from the scene does not by itself release its GPU geometry/material resources.

This is a **real endurance debt**, but it does not invalidate the short F1-A4 hardware gate. The first headset test is intentionally brief and should prioritize correctness of tracking, shooting, Rapier, grab/throw and the wave loop.

Before treating F1 as suitable for long repeated sessions, explicitly resolve the transient resource lifecycle using one or both of:

- shared immutable geometry/material pools for common projectile/effect shapes;
- explicit disposal of resources that are genuinely single-use.

Do **not** solve this with a global `Object3D.remove()` monkeypatch or generic auto-dispose hook. Some meshes/materials are intentionally shared or reused; disposal ownership must remain explicit.

The debt becomes a release blocker before endurance testing or long free-play sessions, not before the first bounded F1 hardware gate.

## Target experience

Build a small room-scale **VR Reactor Defense** game in one arena.

The player stands inside a circular defense platform protecting an energy core while hostile drones arrive in short waves.

Core interaction pillars:

1. **Dual tracked blasters** — trigger fires along the WebXR target ray.
2. **Physical world** — Rapier 3D drives crates / energy orbs and impact impulses.
3. **Grab + throw** — grip/squeeze grabs a nearby physical object and release throws it using tracked controller velocity when available, with bounded motion-estimation fallback.
4. **Enemy pressure** — lightweight drones move toward the reactor / attack zone and can be destroyed.
5. **Short wave loop** — escalating waves, score/progress and a clear win/fail state.
6. **Immediate feedback** — emissive flashes, particles/trails, haptics and synthesized positional audio where practical.

## F1 boundaries

Deliberately keep out of this run unless the core loop is already proven:

- artificial locomotion;
- hand tracking as the main input mode;
- passthrough / mixed reality;
- imported art pipeline;
- multiplayer/backend;
- complex navmesh/pathfinding;
- permanent engine architecture decisions.

## Acceptance gate

F1 is not passed by a desktop preview or production build alone. A physical Quest run should demonstrate:

- page boot reaches `Game: F1 arena ready` before immersive entry is actionable;
- scene enters VR and remains stable;
- both controllers track and fire;
- at least one Rapier-driven object visibly collides with the world;
- grip/squeeze can pick up and release a physical object;
- a thrown object inherits believable motion;
- at least one drone can be deliberately destroyed;
- at least one complete wave can be played without leaving XR;
- no severe frame pacing, input or lifecycle regression relative to F0.

## Short hardware protocol

The next Quest run can be useful even if headset time is brief:

1. Confirm the page identifies itself as **F1-A4**, reports Rapier ready, reports `Game: F1 arena ready`, and only then exposes an actionable VR button.
2. Enter VR and spend a moment checking scale, head tracking and both blasters.
3. Fire each controller once to confirm F0 trigger behavior did not regress.
4. Reach for one of the orange energy orbs on the near pedestals, hold grip/squeeze, move it, then release it with a deliberate throw.
5. If time permits, destroy one drone and continue through at least the first wave.
6. Exit VR and inspect the A4 grab/throw telemetry row. Record whether velocity was reported as native or fallback and the last release speed.

If a material failure occurs, stop compensating and report the earliest broken step. Short raw evidence is more valuable than adapting around a bug.

## Engineering constraints

- Keep F0 evidence intact in documentation.
- Prefer procedural geometry and no runtime CDN assets for the first F1 candidate.
- Physics uses pinned `@dimforge/rapier3d-compat@0.20.0` to minimize WASM/bundler uncertainty.
- Treat haptics/audio as optional feedback; they must never block primary interaction.
- Preserve a cheap desktop fallback where practical, but physical Quest remains authority.
- Do not expose immersive entry before session-critical async initialization and event wiring have completed.
- Do not hide transient-resource debt behind global lifecycle monkeypatches; make GPU ownership explicit before endurance work.
- Keep current top-level dependencies pinned; absence of a dependency lockfile remains a known reproducibility debt until deliberately resolved.
