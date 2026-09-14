# Riftworks R0 — foundation reset

Status: active design + falsification branch (`foundation-reset`).

This reset is driven by Owner evidence, not speculative cleanup. The current B1.2 surface proved useful VR direction, but also exposed foundational faults that make incremental polish unsafe.

## Owner evidence that invalidates the current foundation

Observed in the 2026-09-15 Owner run:

- a running machine can appear to drive on empty air and later fall through the visible room;
- wheels placed in apparently sensible side positions can fail to create useful locomotion;
- creation feels raw, indirect and wrong rather than like manipulating a machine in a workshop;
- the current system is too dependent on hidden inference and implementation topology;
- visual/feedback work is desirable later, but must not begin while spatial, mechanical and authoring truth remain unstable.

These are material findings. They are not polish bugs.

## Root causes already demonstrated

### 1. Render world and simulation world diverged

The tabletop refactor moved authored/runtime visuals under a movable `WorkspaceRoot`, while Rapier kept an anonymous fixed floor in its old coordinate system. The result is an invisible physical plane at workbench height that extends far beyond the visible workbench. A machine can therefore drive through visible empty air, then leave that collider and fall through the room because the visible room floor has no matching physics authority.

This class of bug must become structurally impossible.

### 2. Wheel placement has no real mounting semantics

A powered wheel currently attaches to a structural node and its axis is inferred from that node's position relative to the centroid of the whole structure. This does not represent the place or orientation at which the Owner actually mounted a wheel. The heuristic can be deterministic, testable and still semantically wrong.

Centroid-based mounting inference is retired as an architectural direction.

### 3. The user is manipulating implementation topology

The current document exposes nodes as universal construction sockets. Beams are edges between nodes and powered wheels attach to nodes. This was adequate for B0 proof but is not a sufficient workshop interaction model. A node graph may remain useful internally, but it must not define the entire user-facing grammar.

## R0 durable contracts

### A. One simulation world truth

- The visible test environment and physical test environment must come from one shared environment description.
- Rapier must never create an anonymous floor that has no corresponding visible surface.
- Runtime rigid-body poses are world-space simulation truth.
- Runtime visuals live in world space, not under the authoring workspace transform.
- The authoring workbench may move without changing the simulation environment.

### B. Explicit BUILD → RUN mapping

Three spaces are allowed, with explicit boundaries:

1. **Machine local** — authored machine geometry and intent.
2. **Authoring workspace** — presentation/input transform used to place the machine comfortably in desktop/VR.
3. **Simulation world** — physical room/test-yard coordinates.

`MachineDocument` must not contain workbench height/room placement merely because it is convenient for rendering.

RUN must instantiate a machine-local compiled plan through an explicit `runSpawn` transform into the simulation world. STOP discards runtime state and restores the unchanged authored document.

### C. Environment geometry is shared authority

A single descriptor must drive both:

- visible floor/workbench/test surfaces where relevant;
- fixed Rapier colliders for those same physical surfaces.

A test must be able to assert correspondence between visible/semantic surfaces and runtime colliders without inspecting Three.js pixels.

### D. Parts first; topology is supporting data

The Owner should think in parts and relationships, not implementation nodes.

For R0 the supported authored surface remains deliberately narrow:

- structural beam/member;
- powered wheel.

A structural node graph may continue to represent welded beam topology internally if it remains useful, but it is not a universal attachment API.

### E. A wheel mounts to a host part through an explicit mount frame

A powered wheel must record *where and how* it is mounted. The narrow R0 target is a beam-hosted mount frame rather than a universal future attachment ontology.

Minimum durable intent:

- host structural part identity;
- position in the host part's local frame;
- orientation/axle in the host part's local frame;
- wheel dimensions;
- motor direction/speed.

The compiler resolves that explicit frame. It does not re-infer wheel orientation from machine centroid, viewport direction or incidental global position.

### F. Convenience inference proposes; direct manipulation decides

Inference may generate a placement candidate from a beam hit point/surface normal/controller pose, but before commit the exact candidate must be visible and overridable.

Existing parts remain directly editable after placement. Undo is not a substitute for editing.

### G. Regression gates describe Owner-visible truths

CI must protect behavior, not implementation trivia.

R0 acceptance requires tests for at least:

- moving the authoring workspace cannot move/change simulation-world environment truth;
- a machine RUN spawn is independent of workbench transform;
- the machine can leave the workbench/test spawn area and land/contact the actual visible world floor instead of an invisible plane;
- wheel mount orientation is stable under machine translation/rotation and unrelated geometry changes;
- equivalent left/right wheel mounts produce coherent locomotion semantics;
- RUN/STOP never mutates authored truth;
- current B0 powered-cart causal motion remains demonstrable after the spatial rewrite.

## Interaction direction after the core contracts are green

The builder should move toward a real workshop loop:

- grab/select a real part, not an abstract mode first;
- drag/create structural members directly;
- mount a wheel onto a real host surface/part and see its exact candidate pose before commit;
- change side/orientation/motor intent without deleting and rebuilding;
- preserve permissiveness: strange machines may run if they are mechanically representable;
- diagnostics explain invalid or unstable intent rather than silently correcting it.

This is a direction, not permission to build a large generic editor before the two-part surface is good.

## Deliberate non-goals during R0

Do not add hinge, suspension, steering, thruster, richer materials, audio, visual polish, particles or decorative UX passes.

Do not generalize mount frames into a universal ECS/constraint ontology until Beam + Powered Wheel produce a convincing build → run → observe → improve loop.

Do not call IWER/desktop evidence physical-Quest ergonomics evidence.

## Evidence ladder for R0

1. **RED contracts** — new tests expose the current spatial/mounting failures.
2. **Core GREEN** — machine/world/mount semantics pass without browser presentation.
3. **Runtime GREEN** — Rapier environment + spawn + wheel locomotion consequences pass.
4. **Browser rehearsal** — desktop/IWER demonstrate the same contracts through real interaction paths.
5. **Owner smoke** — free-form building no longer reproduces the reported classes of failure.
6. **Only then:** resume visual/feedback work.

Visual-feedback work is explicitly gated. When R0 reaches that point, the project status should announce it prominently rather than silently drifting into polish.
