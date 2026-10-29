# T17 integration record

Base: dev 3cfd490. Combine only #2, #3, #4, #6, #10, #12, #14, #16, #17, in that order. #13/#15 are excluded. Changes are applied as patches and committed on this branch; no branch merges or changes to dev/main.

## Sources and conflicts

- #2: applied T0 coordination files without conflict. Registered T17 from explicit user assignment.
- #3/#4/#6: T6 panel/hover/shortcuts, local fonts and full RTL/locales combined cleanly in stacked order. Font/license files preserved verbatim.
- #10 conflicts: .gitignore union; package scripts/dependencies combined; HANDOFF preserves both parties' distinct sections and TASKS preserves task-specific evidence plus T17. main.js retains native launch/exit/perf policy, adds T6 hover/shortcuts and Surface behavior; native-managed panels force Surface overlay so native alone owns AppBar. Duplicate system/resting listeners consolidated. preload allowlists union.
