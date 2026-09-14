# Riftworks

Riftworks is a browser/VR engineering sandbox focused on a short creative loop:

> **build → run → observe → improve**

The repository was rebooted in place from the former `WebXR-Lab`. Earlier Quest/WebXR work remains donor evidence that hosted immersive VR and tracked Touch interaction can run on a physical Quest 2; active architecture is Riftworks.

## Current target — B1 VR interaction & presentation foundation

B0 proved that authored machines can compile into disposable Rapier mechanics and produce real contact-driven motion. B1 deliberately pauses new mechanical primitives and strengthens the surface through which those mechanics will be understood and manipulated in VR.

Current B1 foundation:

- `MachineDocument` uses machine-local coordinates; placement in the room is no longer authored machine truth;
- a separate `WorkspaceRoot` owns the tabletop/workbench placement in rendered world space;
- desktop pointer hits and XR grip poses are converted world → workspace-local before authored commands;
- desktop and XR still converge into the same beam/wheel authored operations;
- immersive XR has an in-world tool panel for `BEAM`, `WHEEL`, `RUN/STOP` and `UNDO`; it no longer depends on the desktop HTML panel to complete the basic loop;
- controller trigger targets the spatial panel while grip/squeeze performs direct construction;
- powered-wheel BUILD presentation exposes axle intent and positive motor direction instead of hiding mechanical meaning until RUN;
- RUN presentation is driven by Rapier body poses; no independent drive animation exists;
- desktop has `FOCUS MACHINE` and optional `FOLLOW RUN` as observation aids; these never move the XR camera/head;
- Machine Yard has a first workbench/environment/material/lighting pass rather than a floating debug grid;
- a transparent GitHub verification workflow independently runs install → tests → production build, in addition to Cloudflare deployment checks.

The exact B1 candidate on `d32606b007a2f45a10b6790271846622fe3f4ef3` passed both the GitHub verification job and Cloudflare Workers production deployment.

## Evidence ladder

- authored document + compiler semantics: **PASS**;
- degenerate geometry rejection and beam-axis correspondence: **PASS**;
- Rapier RUN/STOP without authored mutation: **PASS**;
- real powered-wheel revolute motor consequence: **PASS**;
- opposite wheel mount sides preserving one shared motor-axis meaning: **PASS**;
- full four-wheel cart translation through wheel/floor contact: **PASS**;
- machine-local coordinate refactor preserving the proven cart: **PASS**;
- production Vite bundle with spatial XR panel/workspace layer: **PASS**;
- Cloudflare deployment of that exact B1 candidate: **PASS**;
- B1 desktop Owner visual/interaction smoke: **pending**;
- IWER spatial-panel + direct-construction smoke: **pending**;
- physical Quest ergonomics/presence: **not currently available**.

## Desktop owner smoke

1. Open the deployed Riftworks URL.
2. `LOAD PROVEN CART`, then `RUN`.
3. Verify that the wheels visibly rotate and the cart translates through contact physics.
4. Toggle `FOLLOW RUN` and use `FOCUS MACHINE`; these are desktop observation aids only.
5. `STOP` must restore the exact neutral authored construction.
6. Build a small custom structure, place powered wheels, inspect their axle/motor-direction cues, and repeat RUN → STOP.

The desktop smoke validates presentation/readability and interaction plumbing. It is not physical VR proof.

## Local validation

```bash
npm install
npm test
npm run build
npm run dev
```

Add `?emulate=1` to install IWER + DevUI when no native immersive runtime is available.

## Durable boundaries

- `MachineDocument` is authored truth.
- workspace/view transforms are not machine truth.
- compile output is disposable derived data.
- Rapier bodies/joints are runtime state, never authored identity.
- Three objects, HTML, spatial UI, IWER and XR poses are presentation/input adapters.
- desktop and XR input must converge into the same authored commands.
- artificial desktop camera following must never become automatic XR head motion.
- hardware evidence remains distinct from desktop/IWER evidence.
- donor projects provide patterns and evidence, not automatic architecture.
