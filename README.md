# Riftworks

Riftworks is a browser/VR engineering sandbox focused on a short creative loop:

> **build → run → observe → improve**

The repository was rebooted in place from the former `WebXR-Lab`. Earlier Quest/WebXR work remains donor evidence that hosted immersive VR and tracked Touch interaction can run on a physical Quest 2; active architecture is Riftworks.

## Current target — B1 VR interaction & presentation foundation

B0 proved that authored machines can compile into disposable Rapier mechanics and produce real contact-driven motion. B1 deliberately pauses new mechanical primitives and strengthens the surface through which those mechanics are understood, placed, corrected and observed in VR.

Current B1.2 foundation:

- `MachineDocument` uses machine-local coordinates; placement in the room is not authored machine truth;
- a separate `WorkspaceRoot` owns the tabletop/workbench placement in rendered world space;
- Machine Yard was resized and moved into a human-scale direct-reach zone rather than being laid out only for a desktop camera;
- a dedicated `GRAB WORKSPACE` rail lets XR grip translation move the whole workbench without mutating any authored machine coordinate or Rapier-local state;
- desktop pointer hits and XR grip poses are converted world → workspace-local before authored commands;
- immersive XR has an in-world panel for `BEAM`, `WHEEL`, `RUN/STOP` and `UNDO`; the basic loop does not depend on desktop HTML;
- controller trigger targets spatial UI/components while grip/squeeze performs direct construction, nearby component selection or workspace manipulation;
- powered-wheel placement now has a pre-commit ghost that exposes exact position, axle and positive motor direction before authored truth changes;
- an existing powered wheel is selectable independently of the active creation tool; component selection takes priority over accidentally starting a beam drag;
- selected wheels keep stable authored identity while `FLIP SIDE`, `REVERSE`, `DELETE` and `DONE` operate through immutable `MachineDocument` commands and normal Undo history;
- the same wheel-edit semantics are surfaced through desktop contextual controls and the XR spatial panel;
- powered-wheel BUILD presentation exposes axle intent and positive motor direction; RUN presentation remains driven only by Rapier body poses;
- desktop `FOCUS MACHINE` and optional `FOLLOW RUN` are observation aids only and never move the XR head/camera;
- a transparent GitHub verification workflow independently runs install → tests → production build, in addition to Cloudflare deployment checks.

The exact B1.2 code candidate on `ab9a75b29616254cf19d816d564e936cbd2fef88` passed both the GitHub verification job and Cloudflare Workers production deployment.

## Evidence ladder

- authored document + compiler semantics: **PASS**;
- degenerate geometry rejection and beam-axis correspondence: **PASS**;
- Rapier RUN/STOP without authored mutation: **PASS**;
- real powered-wheel revolute motor consequence: **PASS**;
- opposite wheel mount sides preserving one shared motor-axis meaning: **PASS**;
- full four-wheel cart translation through wheel/floor contact: **PASS**;
- machine-local coordinate refactor preserving the proven cart: **PASS**;
- immutable powered-wheel edit/delete semantics with stable component identity: **PASS**;
- production Vite bundle with spatial XR panel, workspace layer, preview and component-edit plumbing: **PASS**;
- Cloudflare deployment of exact B1.2 code candidate `ab9a75b…`: **PASS**;
- desktop Owner visual/interaction smoke for B1.2: **pending**;
- IWER spatial-panel/direct-construction/preview/edit smoke: **pending**;
- one-hand workspace translation comfort and reach: **technically implemented, ergonomics not yet proven**;
- physical Quest ergonomics/presence: **not currently available**.

## B1.2 desktop Owner smoke

1. Open the deployed Riftworks URL and verify the page labels itself `B1.2`.
2. Select `POWERED WHEEL` and hover a structural socket. A translucent wheel preview should appear before placement, showing the proposed axle/motor direction.
3. Place the wheel. Click the existing wheel even after switching back to `BEAM`; it should select the component rather than start an accidental beam drag.
4. Use `FLIP SIDE`, `REVERSE MOTOR`, then `UNDO` and verify the same wheel identity is edited rather than replaced by an unrelated component.
5. Delete a wheel and Undo it.
6. `LOAD PROVEN CART`, select/edit one existing wheel, then `RUN`. Motion should change because authored motor/side intent changed, not because presentation faked it.
7. `STOP` must discard runtime motion and return to the edited authored construction exactly.
8. Toggle `FOLLOW RUN` / `FOCUS MACHINE` only as desktop observation aids.

The desktop smoke validates readability and interaction plumbing. It is not physical VR proof.

## IWER / future Quest smoke

With `?emulate=1` or a physical headset when available:

1. enter immersive XR;
2. use trigger ray on the spatial panel;
3. with `WHEEL` active, move a grip near a socket and verify the pre-placement preview appears before squeeze;
4. squeeze to place, then point at or directly approach the existing wheel to select it;
5. verify the panel switches to `FLIP SIDE / REVERSE / DELETE / DONE` and each action changes authored intent through the same command path as desktop;
6. grab `GRAB WORKSPACE` and move the whole workbench while authored coordinates remain unchanged;
7. RUN/STOP without automatic XR camera motion.

IWER can validate event-path plumbing; only physical hardware can validate comfort, reach, presence and real controller feel.

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
- workspace/view transforms, component selection and previews are not machine truth.
- compile output is disposable derived data.
- Rapier bodies/joints are runtime state, never authored identity.
- Three objects, HTML, spatial UI, IWER and XR poses are presentation/input adapters.
- desktop and XR input must converge into the same authored commands.
- placed components are persistent authored objects intended to be selected and revised, not fire-and-forget stamps corrected only through Undo.
- artificial desktop camera following must never become automatic XR head motion.
- hardware evidence remains distinct from desktop/IWER evidence.
- donor projects provide patterns and evidence, not automatic architecture.
