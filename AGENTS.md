# Project rules

- Treat this repository as a fresh project. Previous WebXR-Lab implementation is history/donor evidence only.
- Do not inherit Reactor Defense, MR spike, old F0/F1/F2 milestones, schemas, or architecture by default.
- Prefer the smallest experiment that can change a decision.
- Keep authored machine truth separate from renderer state, input state, and disposable physics runtime.
- Desktop testability is a first-class requirement because headset access is intermittent.
- A desktop/build PASS never proves VR ergonomics or physical-headset behavior.
- Favor direct construction agency over parameter/hardpoint editors disguised as builders.
- Keep the build→run→observe→modify loop short.
- Strange or bad constructions should generally be runnable; diagnose rather than forbid unless stability/integrity requires it.
- Donor repositories contribute proven patterns/capabilities, not wholesale architecture.
- Avoid premature generic machine/component ontologies. Earn abstractions from representative construction problems.
- Keep code and infrastructure minimal until the construction loop earns value.
