# Riftworks operating rules

Riftworks is a VR-first engineering sandbox with desktop-first validation while headset access is unavailable.

## Product loop

Protect the loop:

`build → run → observe → improve`

Prefer direct construction/topology agency over configuration panels. Strange or poor machines should normally remain runnable; diagnose rather than paternalistically forbid.

## Authority

1. live reproducible behavior and tests;
2. live source;
3. this file and README;
4. historical commits/donor repositories.

`MachineDocument` is the only authored machine truth. Compiler plans, Rapier state, Three scene objects, IWER state and XR poses are disposable projections/adapters.

Runtime evaluation must never silently write back into authored neutral state.

## Testing without a headset

Every substantial capability should be separable into the strongest available evidence layer:

- pure/core test for document semantics and compilation;
- headless/runtime test when physics behavior can be tested without rendering;
- desktop browser interaction for construction/readability;
- IWER desktop emulation for actual WebXR lifecycle/controller event paths;
- physical Quest evidence for presence, ergonomics, tracking feel and final XR acceptance.

Do not describe desktop/IWER evidence as physical Quest proof.

When useful, expose the exact same authored specimen used by headless tests on the Owner surface. This separates simulation failure from browser/presentation or interaction failure.

## Construction grammar

Current research direction is `connect-by-drag + component-first`. Do not regress into a disguised configurator or a hardpoint-only editor. The Owner must be able to create meaningful topology not pre-authored by the prototype.

Convenience inference may propose mechanical intent, but durable intent must remain explicit in `MachineDocument`. Example: a powered wheel stores both its rotation `axis` and independent mount `side`; the solver must not infer semantic intent from viewport or UI state.

## Mechanical causality

A mechanism is not accepted because it animates correctly. Prefer tests that demonstrate solver-level consequences: relative joint motion, contact-driven translation, load response or other physical effects. Presentation must read runtime body poses rather than recreating the motion independently.

## Donors

WebXR-Lab history, VAW, NextGen JV, JES, JURE and ANVIL are donors of evidence and patterns only. Harvest the smallest justified capability; do not import a donor subsystem or ontology unless a current falsifiable need earns it.

## Scope discipline

B0 has now demonstrated authored → compile → RUN → STOP integrity plus a first real powered-wheel mechanism and contact-driven cart locomotion in headless Rapier tests. The next authority gap is Owner desktop interaction/readability, followed by IWER controller-path evidence.

Do not add hinge, thruster, steering, suspension or richer mechanical primitives merely because the backend can support them. First test whether the current direct construction loop is understandable and satisfying enough to extend.
