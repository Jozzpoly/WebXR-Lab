# F1 — Reactor Defense vertical slice

## Why this milestone

F0 proved the hosted WebXR pipeline on a physical Quest 2: immersive session, head tracking, Touch controller tracking, trigger input and deliberate spatial target interaction all worked.

F1 should now maximize experiential gain per hour without turning the lab into a framework project.

## Target experience

Build a small room-scale **VR Reactor Defense** game in one arena.

The player stands inside a circular defense platform protecting an energy core while hostile drones arrive in short waves.

Core interaction pillars:

1. **Dual tracked blasters** — trigger fires along the WebXR target ray.
2. **Physical world** — Rapier 3D drives crates / energy blocks and impact impulses.
3. **Grab + throw** — grip/squeeze grabs a nearby physical object and release throws it using tracked controller velocity when available.
4. **Enemy pressure** — lightweight drones move toward the reactor / attack zone and can be destroyed.
5. **Short wave loop** — escalating waves, score/progress and a clear win/fail state.
6. **Immediate feedback** — emissive flashes, particles/trails, haptics and small synthesized audio cues where practical.

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

F1 is not passed by a desktop preview alone. A physical Quest run should demonstrate:

- scene enters VR and remains stable;
- both controllers track and fire;
- at least one Rapier-driven object visibly collides with the world;
- grip/squeeze can pick up and release a physical object;
- a thrown object inherits believable motion;
- at least one drone can be deliberately destroyed;
- at least one complete wave can be played without leaving XR;
- no severe frame pacing, input or lifecycle regression relative to F0.

## Engineering constraints

- Keep F0 evidence intact in documentation.
- Prefer procedural geometry and no runtime CDN assets for the first F1 candidate.
- Physics uses pinned `@dimforge/rapier3d-compat@0.20.0` to minimize WASM/bundler uncertainty.
- Treat haptics/audio as optional feedback; they must never block primary interaction.
- Preserve a cheap desktop fallback where practical, but physical Quest remains authority.
