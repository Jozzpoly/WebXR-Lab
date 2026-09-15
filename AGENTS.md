# Riftworks operating rules

Riftworks is a VR-first engineering sandbox with desktop-first validation while physical headset access is unavailable.

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

The final product target is VR. Desktop authoring exists to make iteration/testability possible without a headset, not to define the eventual interaction model.

- XR head pose is authority for the user's viewpoint and must not be automatically driven by gameplay;
- desktop camera follow/focus may exist only as an observation aid;
- immersive XR must offer a complete basic loop without depending on invisible desktop HTML controls;
- controller trigger is appropriate for indirect/spatial UI selection; grip/squeeze is the primary direct construction/manipulation gesture;
- spatial controls and desktop controls must invoke the same semantic authored commands;
- component interaction proxies, selection halos, handles and placement ghosts are presentation/input projections only.

### Transient input ownership

Desktop and XR may share semantic commands, but must not concurrently own the same transient drag/preview state.

- outside immersive XR, desktop canvas input owns desktop pointer captures, ghosts and component previews;
- session entry cancels unfinished desktop gestures before XR takes ownership;
- while XR is presenting, desktop canvas adapters must be inert with respect to XR-owned transient state;
- outside immersive XR, XR per-frame authoring logic must not clear or rewrite desktop transient state;
- session end/disconnect clears outgoing XR transient state without allowing late XR events to mutate restored desktop interaction state;
- `pointercancel` and session handoff are cancellation boundaries, never implicit authored commits;
- synchronized interaction geometry must be pick-ready without relying on an unrelated render frame.

Do not generalize this narrow ownership contract into a broad multi-input framework without evidence. HTML/keyboard availability during XR is a product/UX decision, not implied by the transient-state rule above.

## Testing without a headset

Every substantial capability should be separated into the strongest available evidence layer:

- pure/core test for document semantics and compilation;
- headless/runtime test for physics behavior;
- production build verification;
- desktop browser interaction/readability using real browser input;
- IWER emulation for real WebXR lifecycle/controller event paths;
- Owner interaction smoke for human comprehensibility and feel;
- physical Quest evidence for presence, ergonomics, tracking feel and final XR acceptance.

Do not describe desktop/IWER evidence as physical Quest proof. Do not describe deterministic browser choreography as proof that interaction feels good to a human.

GitHub Verify and Cloudflare deployment are separate gates. A GREEN GitHub branch does not prove that a previously established Cloudflare preview currently serves that branch head.

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

## Mechanical and visual causality

A mechanism is not accepted because it animates correctly. Prefer tests that demonstrate solver-level consequences: relative joint motion, contact-driven translation, load response or other physical effects. Presentation must read runtime body poses rather than recreate motion independently.

Visual language should reveal useful mechanical intent before RUN where practical: attachment point, axis, motor direction, selection/snap state and authored-vs-evaluated distinction. Do not use graphics merely as decoration when the same budget can improve causal readability.

During R0, however, visual/haptic/audio polish remains blocked until the foundation survives Owner interaction smoke without a material world/mechanics/creation finding. Do not let polish resume through gradual scope drift.

## Donors

WebXR-Lab history, VAW, NextGen JV, JES, JURE and ANVIL are donors of evidence and patterns only. Harvest the smallest justified capability; do not import a donor subsystem or ontology unless a current falsifiable need earns it.

## Current R0 gate

Automated browser/runtime evidence is currently strong enough to justify Owner smoke, not merge or polish.

Before R0 can replace the old checkpoint on `main`, require:

- Owner free-form interaction evidence;
- confirmation that the original world/wheel failure classes remain absent in normal use;
- physical Quest evidence for reach, comfort, controller targeting and device behavior;
- fresh verification that the deployment used for Owner testing serves the intended branch/runtime.

Keep draft PR #2 unmerged until those evidence gaps are consciously resolved.
