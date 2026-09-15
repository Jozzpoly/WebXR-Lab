# Riftworks operating rules

Riftworks is a VR-first engineering sandbox. When physical headset access is unavailable, development continues through the strongest honest evidence available: desktop interaction, core/runtime tests, adversarial state-machine checks, browser automation and IWER. Lack of current headset access is not a reason to freeze useful work, but desktop/IWER evidence must never be promoted to physical-hardware ergonomics evidence.

## Product loop

Protect:

`build → run → observe → improve`

Prefer direct construction/topology agency over configuration panels. Strange or poor machines should normally remain runnable; diagnose rather than paternalistically forbid.

## Authority

1. live reproducible behavior and tests;
2. live source;
3. this file, `docs/FOUNDATION_RESET.md` and README;
4. historical commits/donor repositories.

`MachineDocument` is the only authored machine truth. Compiler plans, Rapier state, Three scene objects, workspace/view transforms, selection state, previews, IWER state and XR poses are disposable projections/adapters.

Runtime evaluation must never silently write back into authored neutral state.

R0 exists because earlier B1.2 Owner evidence exposed foundation failures in world truth, wheel mounting semantics and user-facing construction grammar. Do not treat legacy B1 interaction behavior as authoritative merely because it still exists in history.

## Spatial and simulation authority

Keep three spaces explicit:

1. **Machine local** — authored machine geometry and intent.
2. **Authoring workspace** — movable presentation/input transform for comfortable building.
3. **Simulation world** — the physical Machine Yard used by Rapier and RUN visuals.

The authoring workspace may move without changing simulation-world truth. RUN must instantiate compiled machine-local geometry through an explicit spawn mapping. Runtime rigid-body poses are simulation-world truth; STOP discards runtime motion and returns to unchanged authored truth.

Visible physical environment surfaces and fixed runtime colliders must derive from shared semantic world descriptions rather than independent magic geometry.

## VR-first interaction boundary

The final product target is VR. Desktop authoring exists to make iteration, discovery and validation possible without a headset; it does not define the eventual embodied interaction model.

- XR head pose is authority for the user's viewpoint and must not be automatically driven by gameplay;
- desktop camera follow/focus may exist only as an observation aid;
- immersive XR must offer a complete basic loop without depending on invisible desktop HTML controls;
- controller trigger is appropriate for indirect/spatial UI selection; grip/squeeze is the current primary direct construction/manipulation gesture;
- spatial controls and desktop controls should converge on the same semantic authored commands where the semantics genuinely match;
- component interaction proxies, selection halos, handles and placement ghosts are presentation/input projections only;
- a desktop interaction experiment must not be copied into XR merely for parity.

### Transient input ownership

Desktop and XR may share semantic commands, but transient gestures have explicit authority.

Durable rule:

> A transient gesture belongs to the interaction context in which it began. If that context changes materially, the gesture is cancelled; it is never carried forward and committed in the new context.

Therefore:

- outside immersive XR, desktop canvas input owns desktop pointer captures, ghosts and component previews;
- session entry cancels unfinished desktop gestures before XR takes ownership;
- while XR is presenting, desktop canvas adapters are inert with respect to XR-owned transient state;
- outside immersive XR, XR per-frame authoring logic must not clear or rewrite desktop transient state;
- session end/disconnect clears outgoing XR transient state without allowing late XR events to mutate restored desktop interaction state;
- BUILD/RUN changes, tool/context changes, destructive edits and equivalent authority transitions cancel incompatible in-flight direct gestures rather than reviving them later;
- workspace grab has exclusive authority over workspace translation while active and must not leave older direct drags alive underneath it;
- `pointercancel` and session handoff are cancellation boundaries, never implicit authored commits;
- synchronized interaction geometry must be pick-ready without relying on an unrelated render frame.

Do not generalize this bounded authority contract into a broad multi-input framework without evidence. In particular, simultaneous two-hand construction remains an open interaction-grammar question; do not silently outlaw or canonize it merely to simplify implementation.

## Evidence while no headset is available

Use the strongest appropriate layer rather than waiting for hardware:

- pure/core tests for authored semantics, geometry and compilation;
- headless/runtime tests for physical consequences;
- production build/fingerprint verification;
- desktop browser input for real mouse interaction and Owner feel;
- adversarial/model-based tests for cancellation, ordering, stale state and competing intents;
- IWER for real WebXR lifecycle/controller event paths and coordinate/transform contracts;
- Owner desktop smoke for human comprehensibility where desktop can answer the question;
- physical Quest evidence later for presence, reach, comfort, tracking feel, controller targeting, device performance and final embodied acceptance.

IWER may deliberately place controllers at ideal poses; that makes it strong event/transform evidence and weak ergonomics evidence. Never describe deterministic browser choreography as proof that interaction feels good to a human.

Latest runtime/evidence-bearing checkpoint is `402527936d870ed3b3fa3b7b3c2e31872d655f68`, verified by `Verify Riftworks` #207 with 73/73 Node tests, desktop 8/8, IWER 18/18 and public-preview attribution PASS for runtime `f132c978549f`. Later branch commits may be documentation-only and therefore do not change that runtime fingerprint; use live Git/PR metadata for the exact current docs head.

GitHub Verify and Cloudflare deployment are separate gates. A GREEN GitHub branch does not prove that a previously established Cloudflare preview currently serves that branch head/runtime unless attribution has also been observed.

When useful, expose the exact same authored specimen used by headless tests on the Owner surface. This separates simulation failure from browser/presentation/interaction failure.

## Construction grammar

Current R0 direction is `blank workshop + part-first + connect-by-drag + direct revision`.

Internal welded nodes remain valid supporting topology, but they are not the public construction grammar or universal attachment API. The Owner should manipulate real parts and physical relationships, not implementation node identities.

The supported authored surface is deliberately narrow for now:

- structural beam/member;
- powered wheel.

Do not add new mechanical primitive kinds merely because the backend can support them. First make Beam + Powered Wheel a strong surface for building, reading, manipulating, correcting and observing machines.

### Powered-wheel mounting

A powered wheel is a persistent authored component mounted to a concrete structural host. Current durable intent is:

- `hostBeamId`;
- host-local `mount.position`;
- host-local normalized `mount.axis`;
- wheel dimensions / mount gap / density;
- signed motor intent and damping.

Do not reintroduce machine-centroid inference, universal-node attachment or legacy independent `side` semantics as authored authority.

Convenience inference may propose a mount from a beam hit point, surface normal or controller pose, but the exact candidate should be visible before commit where practical. The compiler resolves the explicit host-relative frame; it must not re-infer mechanical intent from global position or incidental viewport/controller orientation after commit.

A placed component is a persistent authored object, not a fire-and-forget stamp. Existing components should normally be selectable, directly revised and explicitly rehosted while preserving identity. Undo remains important history but must not become the primary editing model.

Existing authored objects under pointer/ray/direct reach take priority over accidentally starting a new construction gesture. Creation tools should not make already-placed components difficult to select.

## Structural authoring

The blank workshop is a valid authored state. The first beam can be created directly without public node prerequisites.

For existing beams, the current part-first surface uses contextual end operations:

- MOVE reshapes an existing beam through one end;
- EXTEND creates a new structural member from an existing beam end;
- dragging near another physical beam end may weld to that endpoint;
- shared welded topology must remain welded under ordinary reshape;
- host-mounted components should preserve their intended relative anchor when their host beam changes length.

Structural authored commands operate on part identity plus physical end semantics, not exposed node IDs.

The desktop whole-welded-island beam-body drag remains a bounded interaction experiment. It is evidence about direct part/rigid-fragment intent, not an accepted XR gesture or permanent ontology.

## Extensibility boundary

R0 mechanics are intentionally concrete. Do not accidentally promote today's narrow implementation into the permanent ontology of Riftworks.

- A **welded island** is currently a derived connected component of welded structural topology and a useful local manipulation/runtime unit. It is not an authored `Assembly` identity and should not be treated as the universal grouping model.
- `hostBeamId` is the correct explicit mounting authority for the current powered-wheel component. It is **not** automatically the future universal attachment API for every component kind.
- `component` currently means powered wheel in practice because R0 deliberately supports one non-structural component. Do not build a generic component framework until another real mechanical need earns the abstraction.
- Future movable relationships such as hinges, suspension or other articulated mechanisms should be free to connect otherwise separate rigid structures through explicit authored mechanical relations rather than overloading welded topology.
- Direct manipulation should follow physical meaning. If articulated relations are introduced later, grabbing one rigid fragment must not silently imply dragging every connected mechanism through movable joints.
- Prefer explicit document-version evolution/migration when new authored concepts become real. Do not contort `MachineDocument` v2 fields merely to avoid a schema version change.

These are negative constraints, not a predesigned future joint/assembly schema. Keep the future open until experiments earn more structure.

## Mechanical and visual causality

A mechanism is not accepted because it animates correctly. Prefer tests that demonstrate solver-level consequences: relative joint motion, contact-driven translation, load response or other physical effects. Presentation must read runtime body poses rather than recreate motion independently.

Visual language should reveal useful mechanical intent before RUN where practical: attachment point, axis, motor direction, selection/snap state, rigid-fragment scope and authored-vs-evaluated distinction. Causal interaction feedback is part of construction readability when evidence says it is needed; it is not merely decorative polish.

Decorative visual/audio/haptic polish remains secondary while construction grammar and foundation questions are still active.

## Donors

WebXR-Lab history, VAW, NextGen JV, JES, JURE and ANVIL are donors of evidence and patterns only. Harvest the smallest justified capability; do not import a donor subsystem or ontology unless a current falsifiable need earns it.

## Current R0 gate

The branch is mechanically strong enough for continued construction-grammar discovery through desktop/internal evidence. It is not yet merge-authorized.

Before R0 replaces the old checkpoint on `main`, require a conscious decision based on:

- Owner free-form interaction evidence on the current construction surface;
- confirmation that original world/wheel/creation failure classes remain absent in normal use;
- fresh deployment attribution for any Owner-tested runtime;
- physical Quest evidence for reach, comfort, controller targeting and device behavior once hardware is available, unless the Owner explicitly reclassifies the merge gate later.

Physical Quest access is currently deferred/unknown. This must not freeze useful desktop/internal R&D, and no automation result should pretend to close the missing hardware evidence.

Keep draft PR #2 unmerged until those evidence gaps are consciously resolved.
