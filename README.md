# Riftworks

Riftworks is a browser/VR engineering sandbox organized around a short creative loop:

> **build → run → observe → improve**

The repository began as `WebXR-Lab`. Earlier Quest 2 work remains donor evidence that hosted immersive WebXR, tracked Touch controllers and trigger interaction can work on physical hardware. The active project is Riftworks.

## Live development state — R0 foundation reset

Owner testing of B1.2 exposed material foundation failures rather than polish problems:

- a running machine could appear to drive on empty air and later fall through the visible room;
- wheels placed in apparently sensible side positions could fail because their orientation was inferred from machine centroid rather than a real mounting relationship;
- creation exposed implementation nodes/sockets and felt like a raw debug graph rather than manipulating parts in a workshop.

R0 deliberately stops feature growth and visual/feedback polish while these classes of failure are removed.

Development currently lives on `foundation-reset` behind draft PR #2. `main` remains the previous B1.2 checkpoint until the reset earns interaction evidence.

## Current R0 architecture

### One world truth

Three spaces have explicit jobs:

1. **Machine local** — authored machine geometry and intent.
2. **Authoring workspace** — movable presentation/input transform used to keep construction comfortable.
3. **Simulation world** — the real Machine Yard used by Rapier and RUN visuals.

The visible world floor and fixed Rapier floor now come from one `MACHINE_YARD_WORLD` descriptor. Rapier no longer owns an anonymous invisible platform. RUN resolves one explicit `runSpawn`; the exact same spawn pose is supplied to physics and rendering. Moving the workbench cannot move the simulation world.

### Host-relative mechanical mounting

`MachineDocument` v2 keeps structural topology internally, but powered wheels no longer attach to universal nodes and no longer infer orientation from the centroid of the whole machine.

A powered wheel now authors:

- `hostBeamId`;
- host-local mount position;
- host-local axle direction;
- dimensions and mount gap;
- signed motor intent.

Structural beams carry durable roll, so a beam has a real local frame. Desktop and XR wheel placement both resolve a concrete beam surface through the same frame mathematics used by the compiler.

### Part-first structural authoring

Internal welded nodes still exist because they are useful topology. They are no longer the primary user-facing construction grammar.

With `BEAM` active:

- select a real beam;
- the selected part alone exposes contextual end handles;
- **white MOVE handle** reshapes that beam through one of its ends;
- **green EXTEND handle** pulls a new structural beam from that end;
- extending near another physical beam end welds to that endpoint;
- persistent legacy node spheres are hidden from the workshop surface.

Structural edit commands operate on `beamId + end`, not public node IDs. If a shared welded endpoint moves, connected structure remains welded. If a host beam changes length, mounted components preserve their relative longitudinal anchor on that host part.

Desktop pointer and XR controller paths converge into these same authored commands.

## Automated evidence

Current exact R0 candidate:

`6029130e0e5b1d0c45755ae0658f9f8a1bd63631`

GitHub `Verify Riftworks` run `34914182165`:

- dependency install: **PASS**;
- complete Node contract/physics test suite: **PASS**;
- production Vite build: **PASS**.

Protected behavior includes:

- shared visible/physical world floor authority;
- RUN spawn independent from workbench translation;
- RUN/STOP cannot mutate authored truth;
- real four-wheel contact-driven cart translation remains demonstrable;
- explicit beam-host wheel mount frames;
- mirrored physical axle/motor semantics;
- wheel mount stability under unrelated topology changes;
- beam roll carrying mount orientation;
- part-level MOVE/EXTEND structural commands;
- welded topology preservation during reshape;
- mounted-component anchor adaptation during beam resize;
- degenerate structural edits being rejected rather than corrupting truth;
- structural targeting returning part references while deduplicating one physical welded endpoint across multiple internal beam/node aliases.

## Evidence that is still missing

Automated GREEN is not interaction proof.

Still required before R0 can replace the old checkpoint:

- **desktop interaction smoke** of real beam selection, MOVE, EXTEND, wheel surface mount and RUN/STOP;
- **IWER controller-path rehearsal** of the same part-first grammar;
- **Owner free-form smoke** to see whether creation actually feels less raw and whether the original terrain/wheel failure classes remain gone;
- later, physical Quest evidence for reach, comfort and real controller feel.

The repository contains an updated bounded IWER rehearsal (`?emulate=1&rehearse=1`) that exercises the new part-first path, but its existence/buildability is not counted as a rehearsal PASS until it is actually executed in a browser.

## Next smoke contract

The next useful run should test the loop rather than inspect implementation details:

1. Start from the seed beam with `BEAM` active.
2. Select the beam itself. Persistent node/socket markers should not be the construction interface.
3. Drag a white end handle and materially reshape the part.
4. Drag a green end handle and create another beam. Try welding it to another existing beam end if convenient.
5. Switch to `WHEEL`. Hover/approach a real beam face and verify the exact wheel candidate appears before commit.
6. Place a wheel, select that existing wheel, use `MIRROR` and `REVERSE` and confirm the same authored component is edited.
7. `LOAD PROVEN CART` if a known locomotion specimen is useful, then RUN.
8. Verify the machine starts on the visible world floor, does not drive on a hidden elevated platform, and does not fall through the visible floor when leaving the old workbench footprint.
9. STOP and verify the authored construction returns unchanged by runtime motion.

Report the **earliest broken or confusing step** instead of compensating around it. Owner free-play beyond this script is valuable evidence.

## Visual / feedback gate

**Visual, haptic, audio and presentation polish remain intentionally BLOCKED during R0.**

They resume only after the foundation survives interaction smoke without a material creation/world/mechanics finding. That transition must be announced explicitly; it must not happen through gradual scope drift.

## Local validation

```bash
npm install
npm test
npm run build
npm run dev
```

Use `?emulate=1` to install IWER + DevUI when native immersive XR is unavailable. Use `?emulate=1&rehearse=1` for the bounded automated controller-path rehearsal.

## Durable boundaries

- `MachineDocument` is authored truth.
- internal nodes may support welded topology but are not a universal user-facing attachment API.
- workspace/view transforms, selections, handles and previews are not machine truth.
- compile output is disposable derived data.
- Rapier bodies/joints are runtime state, never authored identity.
- runtime rigid-body poses are simulation-world truth.
- Three objects, HTML, spatial UI, IWER and XR poses are presentation/input adapters.
- desktop and XR input must converge into the same authored commands.
- placed parts/components are persistent authored objects intended to be revised directly.
- artificial desktop camera following must never become automatic XR head motion.
- desktop/IWER evidence must never be promoted to physical-hardware ergonomics evidence.
- strange but mechanically representable machines should generally be allowed to run; diagnostics inform rather than paternalistically forbid experimentation.
