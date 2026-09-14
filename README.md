# Riftworks

Riftworks is a browser/VR engineering sandbox focused on a short creative loop:

> **build → run → observe → improve**

The project reuses the former `WebXR-Lab` repository, but not its old gameplay architecture. Earlier WebXR work remains donor evidence that hosted immersive VR, tracked Touch controllers and interaction can run on a physical Quest 2. Active Riftworks development starts from the fresh foundation.

## Current target — B0 powered-machine loop

B0 now asks:

> Can one authored machine be changed through desktop or XR interaction, compiled into disposable Rapier mechanics, produce a real physical consequence, then STOP back to identical authored truth?

Current candidate capabilities:

- one serializable `MachineDocument` authority;
- `socket → drag → socket/free-space` structural beam construction;
- component-first `Powered Wheel → socket` placement;
- wheel axis and mount side are separate explicit authored intent;
- desktop mouse and XR/IWER squeeze routes converge into the same authored commands;
- deterministic structural compiler with rigid islands and mechanical component lowering;
- real Rapier wheel bodies, revolute joints and velocity motors;
- RUN always creates fresh disposable physics state; STOP discards it;
- authored wheels and runtime wheels are visually distinct; runtime body pose is driven by Rapier while collider orientation remains a local presentation transform;
- asymmetric wheel markers make physical rotation observable instead of relying on a visually symmetric cylinder;
- optional IWER + DevUI WebXR emulation via `?emulate=1`;
- `LOAD CI-PROVEN CART SPECIMEN` loads the exact authored cart used by the headless locomotion proof, so browser/presentation failures can be separated from builder-quality failures.

This still does **not** prove good construction feel, headset ergonomics, rich 3D desktop authoring, steering, suspension, hinges, thrusters, persistence, final controls or final architecture.

## Evidence ladder

- authored document + compiler semantics: **PASS**;
- degenerate-geometry rejection and beam-axis correspondence: **PASS**;
- Rapier RUN/STOP without authored mutation: **PASS**;
- one powered wheel producing real relative joint rotation: **PASS**;
- opposite wheel mount sides preserving one shared motor-axis meaning: **PASS**;
- full four-wheel powered-cart translation through wheel/floor contact: **PASS** — the complete candidate previously passed a clean Cloudflare production gate on `bc70f8c75bf5c12f6ffa1c4fe1498e7b4531fdda`;
- clean powered-machine history checkpoint: `47319e42be27092c0c5004572bbb857b9f550b0c`; this status commit exists to obtain a fresh exact production gate after the history cleanup;
- desktop interaction/readability Owner smoke: **not yet proven**;
- IWER controller-path smoke: **not yet proven**;
- physical Quest: **not available in the current phase**.

## Desktop owner smoke

1. Open the deployed Riftworks URL.
2. Press `LOAD CI-PROVEN CART SPECIMEN`.
3. Press `RUN` or Space. The cart should fall under gravity, wheels should visibly rotate, and the machine should translate because of wheel/floor contact — there is no kinematic drive animation.
4. Press `STOP`; the authored cart should snap back exactly to its neutral build state.
5. Press `RESET BUILD`, use Beam to make your own topology, switch to Powered Wheel, click structural sockets, and repeat RUN → STOP → rebuild.

The smoke above validates browser/presentation and basic Owner interaction. It does not replace physical Quest evidence.

## Local validation

```bash
npm install
npm test
npm run build
npm run dev
```

Add `?emulate=1` to the local URL to install IWER when no native immersive runtime is available.

## Durable boundaries

- `MachineDocument` is authored truth.
- compile output is disposable derived data.
- Rapier bodies/joints are runtime state, never authored identity.
- Three objects are presentation and interaction adapters, never machine truth.
- desktop and XR input must converge into the same authored commands.
- hardware evidence remains distinct from emulation and desktop evidence.
- donor projects provide patterns and evidence, not automatic architecture.
