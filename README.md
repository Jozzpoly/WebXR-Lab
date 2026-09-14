# Riftworks

Riftworks is a browser/VR engineering sandbox focused on a short creative loop:

> **build → run → observe → improve**

The project deliberately reuses the former `WebXR-Lab` repository, but not its old gameplay architecture. The earlier WebXR experiments proved that hosted immersive VR, tracked Touch controllers and WebXR interaction can run on a physical Quest 2. That history is donor evidence only; active development starts from the fresh Riftworks foundation.

## Current live target — B0 Machine Loop

B0 asks one narrow but foundational question:

> Can the same authored machine be edited through desktop or XR interaction, compiled into disposable Rapier rigid islands, run under real physics, then stopped without runtime motion mutating authored truth?

Current B0 capabilities:

- one serializable `MachineDocument` authority;
- direct topology change through `socket → drag → socket/free-space` beam construction;
- desktop mouse path and XR `squeeze` path call the same authored command;
- pure deterministic structural compiler that finds rigid islands;
- Rapier 3D runtime generated fresh on every RUN;
- STOP discards runtime state and returns to the authored machine;
- shared renderer resources rather than per-run GPU allocation;
- pure core tests run before every production build;
- optional IWER + DevUI desktop WebXR emulation via `?emulate=1`.

This does **not** yet prove construction feel, headset ergonomics, wheels, hinges, motors, thrusters, persistence, save/load, driving, or final architecture.

## Run locally

```bash
npm install
npm run dev
```

Normal desktop builder: open the Vite URL.

Desktop WebXR emulation: add `?emulate=1`. On localhost IWER is also allowed to install automatically when no native immersive runtime is available.

Validation:

```bash
npm test
npm run build
```

## Durable boundaries

- `MachineDocument` is authored truth.
- compile output is disposable derived data.
- Rapier bodies/joints are runtime state, never authored identity.
- Three objects are presentation and interaction adapters, never machine truth.
- desktop and XR input must converge into the same authored commands.
- hardware evidence remains distinct from emulation and desktop evidence.
- donor projects provide patterns and evidence, not automatic architecture.
