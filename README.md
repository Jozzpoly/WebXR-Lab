# Riftworks

Riftworks is a browser/VR engineering sandbox organized around a short creative loop:

> **build → run → observe → improve**

The repository began as `WebXR-Lab`. Earlier Quest 2 work remains donor evidence that hosted immersive WebXR, tracked Touch controllers and trigger interaction can work on physical hardware. The active project is Riftworks.

## Live development state — R0 foundation reset

Owner testing of B1.2 exposed material foundation failures rather than polish problems:

- a running machine could appear to drive on empty air and later fall through the visible room;
- wheels placed in apparently sensible side positions could fail because their orientation was inferred from machine centroid rather than a real mounting relationship;
- creation exposed implementation nodes/sockets and felt like a raw debug graph rather than manipulating parts in a workshop.

R0 deliberately stopped feature growth while these classes of failure were removed. The authority reset is now mechanically strong enough that the branch has moved into **construction-grammar discovery**: bounded experiments in how authored parts should actually be grabbed, edited and recombined before the project grows into more mechanical primitives.

Development lives on `foundation-reset` behind draft PR #2. `main` remains the previous B1.2 checkpoint until the reset and interaction direction earn the remaining Owner/Quest evidence.

## Current R0 architecture

### One world truth

Three spaces have explicit jobs:

1. **Machine local** — authored machine geometry and intent.
2. **Authoring workspace** — movable presentation/input transform used to keep construction comfortable.
3. **Simulation world** — the real Machine Yard used by Rapier and RUN visuals.

The visible world floor and fixed Rapier floor come from one `MACHINE_YARD_WORLD` descriptor. Rapier no longer owns an anonymous invisible platform. RUN resolves one explicit `runSpawn`; the exact same spawn pose is supplied to physics and rendering. Moving the workbench cannot move the simulation world.

### Host-relative mechanical mounting

`MachineDocument` v2 keeps structural topology internally, but powered wheels no longer attach to universal nodes and no longer infer orientation from the centroid of the whole machine.

A powered wheel authors:

- `hostBeamId`;
- host-local mount position;
- host-local axle direction;
- dimensions and mount gap;
- signed motor intent.

Structural beams carry durable roll, so a beam has a real local frame. Desktop and XR wheel placement both resolve a concrete beam surface through the same frame mathematics used by the compiler.

### Part-first structural authoring

Internal welded nodes still exist because they are useful topology. They are no longer the primary user-facing construction grammar.

The established structural surface is:

- create the first beam directly in a genuinely blank workshop;
- select the real beam rather than public node/socket objects;
- white endpoint handles reshape welded structure;
- green endpoint handles pull new beams and can weld onto another physical beam end;
- persistent legacy node spheres stay hidden.

Structural edit commands operate on `beamId + end`, not public node IDs. If a shared welded endpoint moves, connected structure remains welded. If a host beam changes length, mounted components preserve their relative longitudinal anchor on that host part.

### Experimental direct welded-island grab

Current desktop candidate adds one deliberately bounded interaction experiment:

> **click a beam body → select it; drag the beam body → move its entire welded rigid island in machine space.**

The command translates all connected structural nodes by one machine-space delta. It does not deform the welded island, rewrite host-local component intent, or move unrelated structural islands.

The drag is preview-first: hypothetical geometry is rendered while the pointer moves, but `MachineDocument` is unchanged until release. `pointercancel` discards the gesture.

A real ambiguity found by the new browser gate is now explicit rather than hidden: a powered-wheel preview can overlap the same beam surface the user may want to grab. The current desktop arbitration is:

- short click on the wheel ghost → commit the wheel;
- drag through the same overlap beyond the movement threshold → take structural context and move the welded island.

This behavior is **experimental, desktop-first and awaiting Owner feel evidence**. It is not yet a canonical XR gesture or a permanent design rule.

### Input ownership and transient state

Desktop and XR share authored commands, but they do **not** concurrently own transient drag/preview state.

- outside immersive XR, desktop canvas input owns its pointer captures, beam ghosts and wheel previews;
- when an XR session starts, unfinished desktop drags/previews are cancelled rather than committed or frozen;
- while XR is presenting, desktop canvas adapters are inert and cannot clear or rewrite XR-owned previews;
- XR per-frame authoring logic is inert outside an immersive session and cannot erase desktop ghosts/previews;
- ending or losing XR clears outgoing XR transient state without allowing late controller events to mutate the restored desktop interaction state;
- `pointercancel` means cancellation: it must never be promoted into an authored structural command.

Interaction proxies and structural handles are made pick-ready when they are synchronized. Correct input must not depend on a coincidental render frame occurring first.

## Current evidence

Current verified construction-grammar candidate:

`fa8f23b71f67c7a0c872d4ff85dbd46beb058943`

GitHub `Verify Riftworks` run `34983007068` (#173):

- dependency install: **PASS**;
- complete Node contract/physics/gesture suite: **67/67 PASS**;
- production Vite build: **PASS**;
- real Chromium desktop mouse rehearsal: **8/8 PASS**;
- Chromium + IWER immersive browser rehearsal: **18/18 PASS**.

The desktop rehearsal now executes:

`blank → beam-create → beam-select → beam-extend → wheel-place → direct-island-drag → direct-wheel-rehost → RUN/STOP authority`

The direct-island stage begins from powered-wheel context, deliberately exercises the wheel-preview/beam overlap, drags `b2`, verifies the whole welded island moves, verifies the already-mounted `c1` follows coherently through host-local intent, then continues through rehost and RUN/STOP.

The IWER rehearsal remains:

`blank-workshop → machine-local-authority → beam-create → part-select → beam-extend → beam-reshape → beam-context-close → ray-tool-select → surface-mount-preview → squeeze-place → direct-component-select → direct-component-rehost → contextual-wheel-edit → workspace-grab → run-workspace-isolation → run-stop-authority → beam-delete-cascade → blank-return`

Important protected behavior includes:

- shared visible/physical world-floor authority;
- RUN spawn independent from workbench translation;
- RUN/STOP cannot mutate authored truth;
- contact-driven powered-cart translation remains demonstrable;
- explicit beam-host wheel mount frames;
- wheel mount stability under unrelated topology changes;
- part-level CREATE/MOVE/EXTEND structural commands;
- welded topology preservation during reshape;
- mounted-component anchor adaptation during beam resize;
- direct authored wheel rehosting while preserving identity;
- desktop/XR transient input isolation;
- direct welded-island translation preserving host-local component intent and leaving unrelated islands untouched;
- click-vs-drag arbitration when a wheel preview and structural beam compete for the same pointer surface;
- cancellation of direct island drag without authored mutation.

## Owner evidence

A first real Owner desktop recording from the non-production branch preview already demonstrated that the reset no longer reproduces the old invisible-plane / room-floor failure and that RUN/STOP preserves authored state during free-form use.

That recording predates the direct welded-island grab experiment above. Therefore the current runtime candidate still needs a **small Owner feel pass**, not another broad automated campaign.

The previously confirmed branch preview is:

`https://foundation-reset-webxr-lab.jozzpoly.workers.dev`

Because this repository does not contain the Worker deployment workflow, GitHub GREEN does not prove that the external preview has already advanced to the new runtime candidate. Re-establish preview freshness before judging the new gesture.

## Next Owner question

The next test should be qualitative and short. Build any small welded structure and answer one question:

> **Does grabbing a real beam body to move its whole welded island feel more like manipulating a machine, or does it create a new kind of ambiguity/frustration?**

Useful stress case: mount/preview a wheel, then try both a short click and a deliberate drag in the same area. The current intended distinction is click = wheel commit, drag = structural grab.

Report the earliest moment where intent and result disagree. Do not compensate around it.

## Evidence still missing

Automated/browser GREEN is not human-feel or physical-hardware acceptance.

Still open:

- Owner judgement on the new direct structural manipulation experiment;
- whether whole-island translation is the right unit of manipulation or only one useful gesture among several;
- physical Quest evidence for reach, comfort, controller targeting and real-device behavior;
- an eventual XR direct-manipulation mapping **only if** the interaction metaphor survives desktop Owner testing.

## Scope lock

Do not add new mechanical primitives merely because this interaction experiment is green.

Do not generalize the desktop gesture into a large selection/group/manipulator framework yet.

Do not copy it into XR merely for parity before Owner evidence says the metaphor is worth keeping.

Visual/haptic/audio polish is still not a blanket next step. Interaction information that makes mechanical intent readable may be justified as part of construction grammar; decorative polish remains secondary.

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
- inactive input adapters must be inert with respect to another adapter's preview/drag state.
- system cancellation and session handoff cancel transient gestures; they do not silently commit authored changes.
- placed parts/components are persistent authored objects intended to be revised directly.
- artificial desktop camera following must never become automatic XR head motion.
- desktop/IWER evidence must never be promoted to physical-hardware ergonomics evidence.
- strange but mechanically representable machines should generally be allowed to run; diagnostics inform rather than paternalistically forbid experimentation.
