# Riftworks operating rules

Riftworks is a VR-first engineering sandbox with desktop-first validation while physical headset access is unavailable.

## Product loop

Protect:

`build → run → observe → improve`

Prefer direct construction/topology agency over configuration panels. Strange or poor machines should normally remain runnable; diagnose rather than paternalistically forbid.

## Authority

1. live reproducible behavior and tests;
2. live source;
3. this file and README;
4. historical commits/donor repositories.

`MachineDocument` is the only authored machine truth. Compiler plans, Rapier state, Three scene objects, workspace/view transforms, selection state, previews, IWER state and XR poses are disposable projections/adapters.

Runtime evaluation must never silently write back into authored neutral state.

## VR-first interaction boundary

The final product target is VR. Desktop authoring exists to make iteration/testability possible without a headset, not to define the eventual interaction model.

- machine coordinates are local to the authored machine/workspace, not room/world coordinates;
- the workbench/world may move for comfort without mutating authored machine geometry;
- XR head pose is authority for the user's viewpoint and must not be automatically driven by gameplay;
- desktop camera follow/focus may exist only as an observation aid;
- immersive XR must offer a complete basic loop without depending on invisible desktop HTML controls;
- controller trigger is appropriate for indirect/spatial UI selection; grip/squeeze is the primary direct construction/manipulation gesture;
- spatial controls and desktop controls must invoke the same semantic commands;
- component interaction proxies, selection halos and placement ghosts are presentation/input projections only.

## Testing without a headset

Every substantial capability should be separated into the strongest available evidence layer:

- pure/core test for document semantics and compilation;
- headless/runtime test for physics behavior;
- production build verification;
- desktop browser interaction/readability;
- IWER emulation for real WebXR lifecycle/controller event paths;
- physical Quest evidence for presence, ergonomics, tracking feel and final XR acceptance.

Do not describe desktop/IWER evidence as physical Quest proof.

A GitHub verification workflow must remain transparent enough to identify whether failure occurs during dependency installation, tests or browser production build. Cloudflare deployment is a separate hosting gate.

When useful, expose the exact same authored specimen used by headless tests on the Owner surface. This separates simulation failure from browser/presentation/interaction failure.

## Construction grammar

Current direction is `connect-by-drag + component-first + direct revision`. Do not regress into a disguised configurator or hardpoint-only editor. The Owner must eventually be able to create meaningful topology not pre-authored by the prototype.

Convenience inference may propose mechanical intent, but durable intent must remain explicit in `MachineDocument`. Powered wheels, for example, store rotation `axis` and independent mount `side`.

Placement should reveal important inferred intent before commit where practical. If the user can reasonably be surprised by side, axis, orientation or motor direction after placement, prefer a pre-placement preview over explaining the result afterward.

A placed component is a persistent authored object, not a fire-and-forget stamp. Existing components should normally be selectable and revised directly. Undo remains important history, but must not become the primary editing model for correcting a component that already exists.

Component identity should remain stable across ordinary intent edits. Moving a component to a different structural host, changing component kind, or performing another identity-level transformation should be an explicit operation rather than a silent patch side effect.

Existing authored objects under pointer/ray/direct reach take priority over accidentally starting a new construction gesture. Creation tools should not make already-placed components difficult to select.

## Mechanical and visual causality

A mechanism is not accepted because it animates correctly. Prefer tests that demonstrate solver-level consequences: relative joint motion, contact-driven translation, load response or other physical effects. Presentation must read runtime body poses rather than recreate motion independently.

Visual language should reveal useful mechanical intent before RUN where practical: attachment point, axis, side, motor direction, selection/snap state and authored-vs-evaluated distinction. Do not use graphics merely as decoration when the same budget can improve causal readability.

## Donors

WebXR-Lab history, VAW, NextGen JV, JES, JURE and ANVIL are donors of evidence and patterns only. Harvest the smallest justified capability; do not import a donor subsystem or ontology unless a current falsifiable need earns it.

## Scope discipline

B0 proved authored → compile → RUN → STOP integrity, powered-wheel mechanics and contact-driven cart locomotion. B1 is intentionally focused on VR interaction/presentation foundation: machine-local workspace separation, human-scale reach, spatial controls, workspace manipulation, visual mechanical language, pre-placement truth, direct editing and observation quality.

Do not add hinge, thruster, steering, suspension or richer mechanical primitive kinds merely because the backend can support them. First make Beam + Powered Wheel a strong surface for building, reading, manipulating, correcting and observing machines in a VR-first workflow.
