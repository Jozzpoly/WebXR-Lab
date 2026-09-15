# Riftworks

Riftworks is a browser/VR engineering sandbox organized around a short creative loop:

> **build → run → observe → improve**

The repository began as `WebXR-Lab`. Earlier physical Quest 2 work remains donor evidence that hosted immersive WebXR, tracked Touch controllers and controller interaction can work on real hardware. The active product direction is Riftworks: a VR-first physical engineering workshop rather than a conventional CAD/editor surface.

## Live state — R0 foundation reset

Development lives on `foundation-reset` behind draft PR #2. `main` remains the previous B1.2 checkpoint.

R0 was triggered by Owner evidence that exposed foundation failures rather than polish problems:

- RUN could interact with an invisible physical plane disconnected from the visible room;
- apparently sensible wheels could fail because mounting orientation was inferred from machine centroid rather than a real host relationship;
- public construction exposed implementation nodes/sockets and felt unlike manipulating parts in a workshop.

Those failure classes were cut out rather than patched around. The branch is now mechanically strong enough for **construction-grammar discovery**, but it is still deliberately narrow and not merge-authorized.

## Current verified checkpoint

Latest runtime/evidence-bearing checkpoint:

`402527936d870ed3b3fa3b7b3c2e31872d655f68`

Later branch commits synchronize canonical documentation only; documentation is intentionally excluded from the runtime fingerprint. Use live Git history/PR metadata for the exact latest docs-only head.

GitHub `Verify Riftworks` run `34997954464` (#207):

- locked dependency install through `npm ci`: **PASS**;
- Node contract / physics / gesture / evidence suite: **73/73 PASS**;
- production build: **PASS**;
- production runtime fingerprint verification: **PASS**;
- real Chromium desktop rehearsal: **8/8 PASS**;
- Chromium + IWER immersive rehearsal: **18/18 PASS**;
- public branch-preview attribution: **PASS**.

Verified runtime fingerprint:

`f132c978549f`

Public branch preview:

`https://foundation-reset-webxr-lab.jozzpoly.workers.dev`

Verify #207 independently fetched that preview and proved that it serves the exact `f132c978549f` runtime built by the same run.

## Current R0 architecture

### One world truth

Three spaces have explicit jobs:

1. **Machine local** — authored machine geometry and intent.
2. **Authoring workspace** — movable presentation/input transform for comfortable building.
3. **Simulation world** — the physical Machine Yard used by Rapier and RUN visuals.

Visible physical environment and fixed Rapier surfaces derive from shared semantic world descriptions. RUN resolves one explicit machine-local → simulation-world spawn. Moving the workbench cannot move simulation-world truth. STOP discards runtime motion and restores unchanged authored state.

### Host-relative powered-wheel mounting

A powered wheel authors concrete mechanical intent against a real structural host:

- `hostBeamId`;
- host-local mount position;
- host-local axle direction;
- dimensions / mount gap / density;
- signed motor intent and damping.

The compiler resolves that frame. It no longer infers wheel orientation from machine centroid, public node identity or incidental view/controller orientation after commit.

### Part-first structural authoring

Internal welded nodes still support topology, but they are not the public construction grammar.

Current structural surface:

- create the first beam directly from a genuinely blank workshop;
- select real beams rather than node/socket objects;
- white endpoint handles reshape existing structure;
- green endpoint handles pull new beams and can weld onto another real beam end;
- shared welded topology remains welded under normal reshape;
- hosted components preserve intended relative anchors when their host changes length.

### Experimental desktop rigid-fragment grab

Current desktop experiment adds:

> **click a beam body → select it; drag the beam body → translate its whole welded rigid island in machine space.**

Connected structure moves as one rigid authored fragment; hosted component intent stays host-local; unrelated islands remain fixed. Preview is transient and commits once on release.

When a wheel-placement ghost overlaps the same beam surface, the current desktop arbitration is:

- short click → commit wheel placement;
- deliberate drag past threshold → take structural context and move the welded island.

This remains a **desktop interaction experiment**, not an accepted XR gesture and not a permanent `Assembly` model.

### Transient interaction authority

A recent adversarial audit found that stale gestures could survive context changes and commit later. Current defended rule is:

> **A transient gesture belongs to the context in which it began. If that context changes materially, the gesture is cancelled; it is never carried into the new context and committed there.**

The current candidate now defends, among other cases:

- desktop structural drag cancelled across BUILD/RUN keyboard transition;
- pending desktop wheel placement cancelled across tool-context change;
- XR structural grip cancelled before trigger-driven RUN/STOP or other incompatible context change;
- session handoff cancels outgoing desktop/XR transient state;
- workspace grab cancels older direct drags before taking workspace-translation authority;
- `pointercancel` is cancellation, never an authored commit.

This does **not** settle final simultaneous two-hand construction grammar. Bimanual authoring remains an open product question rather than something silently forbidden for implementation convenience.

## Automated browser paths

Desktop rehearsal:

`blank → beam-create → beam-select → beam-extend → wheel-place → direct-island-drag → direct-wheel-rehost → RUN/STOP authority`

IWER rehearsal:

`blank-workshop → machine-local-authority → beam-create → part-select → beam-extend → beam-reshape → beam-context-close → ray-tool-select → surface-mount-preview → squeeze-place → direct-component-select → direct-component-rehost → contextual-wheel-edit → workspace-grab → run-workspace-isolation → run-stop-authority → beam-delete-cascade → blank-return`

IWER uses programmatically controlled controller poses and is strong evidence for WebXR lifecycle, events, transforms and authored semantics. It is **not** evidence that real-world reach, comfort, tracking or embodied interaction feels good.

## Owner evidence and hardware boundary

An earlier real Owner desktop run already demonstrated that the original invisible-plane / room-floor failure did not reproduce in normal free-form use and that RUN/STOP restored authored construction after simulation.

The newer desktop whole-island grab still needs qualitative human judgement as construction-grammar work continues.

Physical Quest evidence remains **UNPROVEN** for the current R0 candidate. Headset access is currently unavailable/unknown, so it is a deferred hardware gate rather than the active project scheduler.

Until hardware becomes available, work continues through the strongest honest evidence available:

- desktop interaction and Owner feel where desktop can answer the question;
- core/runtime tests;
- adversarial state/intent sequences;
- browser automation;
- IWER lifecycle/controller/transform checks;
- bounded model/property tests and other reproducible internal falsification.

None of those layers should be described as physical-Quest ergonomics proof.

## Active direction

The current goal is **not** to grow the mechanical catalog. Beam + Powered Wheel remain the wind tunnel for discovering a strong construction grammar.

Continue to improve and falsify:

- direct part manipulation;
- state/intent arbitration;
- snap/mount/host causal readability;
- revision/rehost/cancellation semantics;
- the short build → run → observe → improve loop;
- hardware readiness without guessing at physical comfort.

Do not add Hinge, Servo, Thruster, suspension or a generic component/assembly framework merely because CI is green.

Do not copy desktop whole-island drag into XR merely for parity. A future native VR rigid-grab, if earned, needs its own 6DoF interaction design and a real rigid-transform authored command that transports beam frame/roll and hosted mounts coherently.

## Durable boundaries

- `MachineDocument` is authored truth.
- internal nodes may support welded topology but are not a universal public attachment API.
- a welded island is a derived rigid connected component, not authored `Assembly` identity.
- workspace/view transforms, selections, handles and previews are not machine truth.
- compile output is disposable derived data.
- Rapier bodies/joints are runtime state, never authored identity.
- runtime rigid-body poses are simulation-world truth.
- Three objects, HTML, spatial UI, IWER and XR poses are presentation/input adapters.
- inactive or superseded input contexts must not retain authority to commit stale gestures.
- placed parts/components are persistent authored objects intended to be revised directly.
- artificial desktop camera following must never become automatic XR head motion.
- GitHub repo correctness and public deployment freshness are separate evidence gates.
- strange but mechanically representable machines should generally remain runnable; diagnostics inform rather than paternalistically forbid experimentation.

## Local validation

```bash
npm ci
npm test
npm run build
npm run dev
```

Use `?emulate=1` to install IWER + DevUI when native immersive XR is unavailable. Use `?emulate=1&rehearse=1` for the bounded automated controller-path rehearsal.

## Merge boundary

PR #2 remains **draft / DO NOT MERGE YET**.

Before R0 replaces the old `main` checkpoint, require a conscious evidence decision covering current Owner interaction judgement, absence of the original foundation failure classes, deployment attribution for the tested runtime, and physical Quest evidence once hardware is available unless the Owner explicitly reclassifies that requirement later.

Missing hardware evidence is deferred; it is neither silently satisfied nor a reason to stop useful desktop/internal R&D.
