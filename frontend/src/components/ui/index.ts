// shadcn-vue UI components — usage audit (2026-04-02)
//
// All components currently present in this directory ARE actively imported
// across the frontend views. None are unused as of this audit:
//
//   button   — imported in 13 files
//   card     — imported in 14 files
//   checkbox — imported in 2 files (FuelEntry.vue, HealthScan.vue)
//   input    — imported in 9 files
//   label    — imported in 8 files
//   select   — imported in 5 files
//   slider   — imported in 1 file (FuelEntry.vue)
//
// If a new shadcn component is scaffolded but not yet wired into a view,
// note it here so it can be tracked as planned rather than accidentally removed.

export {}
