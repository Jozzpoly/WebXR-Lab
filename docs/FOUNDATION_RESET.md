# Riftworks R0 — foundation reset

Status: active design + falsification branch (`foundation-reset`), mechanically strong enough for continued construction-grammar research but not merge-authorized.

R0 is driven by Owner evidence, not speculative cleanup. B1.2 established useful WebXR direction but exposed foundational faults that made incremental polish unsafe.

## Owner evidence that triggered R0

Observed in the 2026-09-15 Owner run:

- a running machine could appear to drive on empty air and later fall through the visible room;
- wheels placed in apparently sensible side positions could fail because mounting intent was inferred from unrelated machine geometry;
- creation exposed raw implementation topology and felt unlike manipulating a machine in a workshop;
- spatial, mechanical and authoring truth were not aligned strongly enough to support further feature growth.

These were foundation findings, not polish bugs.

## Root causes recovered

### 1. Render world and simulation world diverged

Authored/runtime visuals had moved under a movable workspace while Rapier kept an anonymous fixed floor in another coordinate frame. A machine could therefore drive on invisible collision and later fall through the visible room.

R0 replaced this with shared semantic world authority and an explicit Machine-local → Simulation-world RUN spawn.

### 2. Wheel placement lacked real mounting semantics

A powered wheel previously attached through structural topology and inferred orientation from the whole-machine centroid. The heuristic could be deterministic and still semantically wrong.

R0 retired centroid/node inference in favor of a concrete host beam plus host-local mount frame.

### 3. The public grammar exposed implementation topology

Nodes remain useful internal welded-topology data, but they are no longer the public construction grammar. The user manipulates parts and physical relationships.

### 4. Input adapters could preserve stale transient authority

Desktop and XR can share authored commands while still corrupting interaction if old previews/drags survive context transitions.

R0 first established desktop/XR ownership boundaries and true cancellation on session handoff. A later adversarial audit found a second class of stale-context bugs: structural/component gestures could survive BUILD/RUN, tool, selection or destructive context changes and then commit after the interaction reality had changed.

Current durable rule:

> **A transient gesture belongs to the context in which it began. If that context changes materially, the gesture is cancelled; it is never carried forward and committed in the new context.**

This now applies across the defended desktop and XR paths. Workspace grab also cancels older direct drags before taking exclusive workspace-translation authority.

This does **not** define final bimanual construction policy. Simultaneous two-hand authoring remains an open construction-grammar question rather than something to prohibit merely for implementation convenience.

## R0 durable contracts

### A. One simulation-world truth

- Visible physical environment and fixed runtime colliders derive from shared semantic world descriptions.
- Rapier does not own anonymous floors with no visible counterpart.
- Runtime rigid-body poses are simulation-world truth.
- Runtime visuals live in world space rather than inheriting authoring-workspace transforms.
- Moving the authoring workspace cannot move the simulation environment.

### B. Explicit BUILD → RUN mapping

Three spaces have explicit jobs:

1. **Machine local** — authored machine geometry and intent.
2. **Authoring workspace** — movable presentation/input transform.
3. **Simulation world** — physical Machine Yard coordinates.

`MachineDocument` does not contain workbench/room placement merely for rendering convenience. RUN compiles authored machine-local truth and instantiates it through one explicit spawn mapping. STOP discards runtime motion and returns to unchanged authored truth.

### C. Parts first; topology supports them

The intentionally narrow R0 authored surface is:

- structural beam/member;
- powered wheel.

Internal welded nodes support topology but are not a universal user-facing socket API.

### D. Explicit host-relative wheel mounts

A powered wheel records concrete mechanical intent:

- `hostBeamId`;
- host-local mount position;
- host-local normalized axle direction;
- wheel dimensions / mount gap / density;
- signed motor intent and damping.

Convenience inference may propose a candidate from a real beam surface. The compiler resolves the authored host-relative frame and does not rediscover intent from centroid, viewport or incidental world position.

### E. Direct revision rather than fire-and-forget stamping

Placed components remain persistent authored objects. They can be selected, revised and rehosted while preserving identity. Undo is history, not the primary editing model.

Current desktop whole-welded-island translation is a bounded interaction experiment. A welded island is a derived rigid connected component, not an authored `Assembly` identity or a promise about future articulated mechanisms.

### F. Transient authority is explicit

- desktop adapters are inert while immersive XR owns transient state;
- XR per-frame authoring is inert outside XR and cannot erase desktop state;
- session handoff/disconnect cancels outgoing transient gestures;
- incompatible BUILD/RUN, tool, selection and destructive context changes cancel in-flight gestures;
- system cancellation never becomes an authored commit;
- interaction proxies/handles are pick-ready when synchronized;
- workspace translation has exclusive transient authority while active.

Do not inflate this into a generic multi-input framework without a demonstrated need.

### G. Regression gates defend Owner-visible truths

Tests and rehearsals should defend outcomes such as:

- visible/physical world correspondence;
- workspace-independent RUN spawn;
- RUN/STOP authored-state preservation;
- real contact-driven powered-wheel consequences;
- explicit and topology-stable host-relative mounting;
- part-first CREATE/MOVE/EXTEND semantics;
- direct wheel rehosting with identity preservation;
- cancellation of stale gestures across input/context transitions;
- real browser execution of desktop and emulated XR interaction paths.

## Current verified checkpoint

Current branch/evidence head:

`402527936d870ed3b3fa3b7b3c2e31872d655f68`

GitHub `Verify Riftworks` run `34997954464` (#207):

- locked `npm ci` dependency install: **PASS**, 0 reported vulnerabilities;
- Node contract / physics / gesture / evidence suite: **73/73 PASS**;
- production build: **PASS**;
- production runtime fingerprint verification: **PASS**;
- real Chromium desktop rehearsal: **8/8 PASS**;
- Chromium + IWER immersive rehearsal: **18/18 PASS**;
- public branch-preview runtime attribution: **PASS**.

Verified runtime fingerprint:

`f132c978549f`

Verified public branch preview:

`https://foundation-reset-webxr-lab.jozzpoly.workers.dev`

The preview was independently fetched by Verify #207 and shown to serve the exact `f132c978549f` runtime built by that run.

### New authority regressions in this checkpoint

The 73-test suite now explicitly defends:

- desktop structural creation cannot survive a Space BUILD/RUN context change and commit later;
- a pending desktop wheel placement cannot survive a tool-context change and stamp later;
- an XR structural grip cannot survive a trigger-driven RUN/STOP context transition and commit afterward.

The existing browser rehearsals continue to pass unchanged, showing that cancellation hardening did not break the established construction loop.

## Current evidence ladder

Current status by evidence type:

1. **Core/document semantics** — strong automated PASS.
2. **Runtime physics/world authority** — strong automated PASS for defended cases.
3. **Desktop real-browser lifecycle** — PASS for the automated path; human feel remains an Owner question.
4. **IWER WebXR lifecycle/transform path** — PASS for the automated path.
5. **Owner desktop evidence** — already removed the original invisible-plane/world-authority failure class from normal observed use; newer direct-grab feel still remains open.
6. **Physical Quest evidence** — **UNPROVEN / deferred until hardware access exists**.

IWER deliberately uses programmatic controller poses and is therefore strong evidence for event/state/coordinate behavior, not for reach, comfort, tracking feel or embodied ergonomics.

Physical Quest access is currently unknown. This does **not** freeze R&D. Until hardware exists, continue extracting honest value from desktop interaction, adversarial/state-machine testing, model/property tests, browser automation, IWER and other reproducible internal evidence.

Never call those layers physical-Quest proof.

## Active direction while Quest is unavailable

Continue construction-grammar discovery without broadening the mechanical catalog.

High-value work includes:

- falsifying state/intent arbitration and stale-state failure modes;
- improving causal readability where it affects construction understanding rather than decoration;
- bounded desktop interaction experiments that teach us about part/rigid-fragment intent without being assumed to define VR gestures;
- adversarial or model-based sequences that can find real authority/topology errors before a human encounters them;
- preserving a clean hardware-ready candidate so future Quest access can immediately produce new evidence instead of requiring repair/setup first.

Do not turn missing hardware into an excuse to guess at comfort/reach/haptics. Those questions remain honestly open.

## Deliberate non-goals during R0

Do not add Hinge, Servo, Thruster, suspension, richer materials or a generic component/assembly framework simply because automation is green.

Do not generalize host frames into a universal ECS/constraint ontology before real mechanisms earn that abstraction.

Do not automatically copy the desktop welded-island drag into XR. If rigid direct manipulation survives later evidence, design a native VR mapping rather than mouse parity.

Do not treat decorative visual/audio/haptic polish as the next default tranche. Causal feedback that reveals host, snap, axis, rigid-fragment scope or predicted mechanical consequence may be construction grammar and can be justified separately.

## Merge boundary

PR #2 remains draft and **DO NOT MERGE YET**.

Before R0 replaces the old `main` checkpoint, require a conscious evidence decision covering:

- current Owner interaction judgement;
- continued absence of the original world/wheel/creation failure classes;
- deployment attribution for the runtime actually tested;
- physical Quest reach/comfort/controller/device evidence when hardware becomes available, unless the Owner later explicitly reclassifies that merge requirement.

The hardware gate is deferred, not silently satisfied and not a reason to stop useful work.
