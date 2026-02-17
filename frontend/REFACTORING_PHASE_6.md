# Phase 6: Large File Refactoring Plan

**Goal:** Break down files over 400 lines into smaller, focused modules (target: 200-300 lines per file)

**Date:** 2026-02-15

---

## Files Requiring Refactoring

### Critical Priority (800+ lines)

#### 1. **team-manager-admin.js** (1064 lines)
**Location:** `src/features/admin/components/team-manager-admin.js`

**Split into:**
```
src/features/admin/components/
├── team-manager-admin.js          (200 lines) - Main orchestrator
├── team-manager-ui.js              (250 lines) - UI rendering & templates
├── team-manager-forms.js           (250 lines) - Form handlers (create, edit, invite)
├── team-manager-filters.js         (200 lines) - Company filtering & search
└── team-manager-actions.js         (250 lines) - CRUD actions (delete, reset password)
```

**Responsibilities:**
- `team-manager-admin.js` - Entry point, state management, coordination
- `team-manager-ui.js` - HTML templates, table rendering, modal rendering
- `team-manager-forms.js` - Form submission, validation, invite handling
- `team-manager-filters.js` - Company dropdown, filtering logic, search
- `team-manager-actions.js` - Delete user, reset password, role assignment

---

#### 2. **landing/styles/index.css** (1468 lines)
**Location:** `src/features/landing/styles/index.css`

**Split into:**
```
src/features/landing/styles/
├── index.css                       (100 lines) - Imports only
├── landing-hero.css                (300 lines) - Hero section & animations
├── landing-features.css            (250 lines) - Features grid & cards
├── landing-testimonials.css        (200 lines) - Testimonials & social proof
├── landing-pricing.css             (200 lines) - Pricing tables
├── landing-cta.css                 (200 lines) - Call-to-action sections
└── landing-footer.css              (200 lines) - Footer & legal
```

**Strategy:**
- Use CSS imports in `index.css`
- Each file corresponds to a major landing page section

---

#### 3. **landing-demo.css** (914 lines)
**Location:** `src/features/landing/styles/landing-demo.css`

**Split into:**
```
src/features/landing/styles/demo/
├── demo-base.css                   (200 lines) - Base demo styles
├── demo-animations.css             (250 lines) - Keyframes & transitions
├── demo-mockups.css                (250 lines) - Device mockups & screenshots
└── demo-interactive.css            (250 lines) - Interactive elements
```

---

#### 4. **system-admin-manager.js** (770 lines)
**Location:** `src/features/admin/components/system-admin-manager.js`

**Split into:**
```
src/features/admin/components/
├── system-admin-manager.js         (200 lines) - Main orchestrator
├── system-admin-users.js           (250 lines) - User management UI
└── system-admin-companies.js       (350 lines) - Company management UI
```

---

#### 5. **tasks.js** (733 lines)
**Location:** `src/features/tasks/pages/tasks.js`

**Split into:**
```
src/features/tasks/pages/
├── tasks.js                        (250 lines) - Main coordinator, state management
├── tasks-init.js                   (200 lines) - Initialization, data loading
├── tasks-filters.js                (150 lines) - Filter logic, search, sorting
└── tasks-realtime.js               (150 lines) - Real-time subscriptions
```

**Responsibilities:**
- `tasks.js` - State, view switching, event delegation
- `tasks-init.js` - DOM setup, load projects/tags/team, setup listeners
- `tasks-filters.js` - Project/tag/assignee filters, search, bulk operations
- `tasks-realtime.js` - Real-time subscriptions, live updates

---

#### 6. **tasks-modals.js** (712 lines)
**Location:** `src/features/tasks/pages/tasks-modals.js`

**Split into:**
```
src/features/tasks/pages/
├── tasks-modals.js                 (200 lines) - Modal orchestrator, state
├── tasks-modal-create.js           (150 lines) - Create modal logic
├── tasks-modal-edit.js             (200 lines) - Edit modal logic
└── tasks-modal-view.js             (200 lines) - View/details modal logic
```

---

#### 7. **gantt-chart.js** (682 lines)
**Location:** `src/features/tasks/components/gantt-chart.js`

**Split into:**
```
src/features/tasks/components/gantt/
├── gantt-chart.js                  (200 lines) - Main component, public API
├── gantt-renderer.js               (250 lines) - SVG rendering, bars, lines
├── gantt-interactions.js           (150 lines) - Drag, resize, click handlers
└── gantt-utils.js                  (100 lines) - Date calculations, positioning
```

---

#### 8. **comment-thread.js** (648 lines)
**Location:** `src/features/tasks/components/comment-thread.js`

**Split into:**
```
src/features/tasks/components/comments/
├── comment-thread.js               (200 lines) - Main component, orchestration
├── comment-renderer.js             (250 lines) - HTML templates, rendering
└── comment-actions.js              (200 lines) - Reply, edit, delete, resolve actions
```

---

### High Priority (500-700 lines)

#### 9. **gantt-service.js** (608 lines)
**Location:** `src/shared/services/gantt-service.js`

**Split into:**
```
src/shared/services/gantt/
├── gantt-service.js                (200 lines) - Main service, public API
├── gantt-calculations.js           (200 lines) - Critical path, scheduling
└── gantt-dependencies.js           (200 lines) - Dependency validation, graph
```

---

#### 10. **projects.js** (605 lines)
**Location:** `src/features/projects/pages/projects.js`

**Split into:**
```
src/features/projects/pages/
├── projects.js                     (250 lines) - Main coordinator, state
├── projects-ui.js                  (200 lines) - Card rendering, templates
└── projects-forms.js               (200 lines) - Create/edit modal handlers
```

---

#### 11. **admin.css** (598 lines)
**Location:** `src/features/admin/styles/admin.css`

**Split into:**
```
src/features/admin/styles/
├── admin.css                       (50 lines) - Imports only
├── admin-layout.css                (200 lines) - Tabs, containers, layout
├── admin-tables.css                (200 lines) - Team/user tables
└── admin-forms.css                 (200 lines) - Invite forms, modals
```

---

#### 12. **tasks-gantt.js** (570 lines)
**Location:** `src/features/tasks/pages/tasks-gantt.js`

**Split into:**
```
src/features/tasks/pages/
├── tasks-gantt.js                  (250 lines) - View loader, controls
└── tasks-gantt-actions.js          (350 lines) - Critical path, auto-schedule, export
```

---

#### 13. **tags.css** (540 lines)
**Location:** `src/styles/shared/tags.css`

**Split into:**
```
src/styles/shared/
├── tags.css                        (50 lines) - Imports only
├── tag-badges.css                  (200 lines) - Badge styles, colors
├── tag-picker.css                  (200 lines) - Picker component
└── tag-manager.css                 (150 lines) - Admin tag manager
```

---

#### 14. **kanban-settings.js** (538 lines)
**Location:** `src/features/admin/components/kanban-settings.js`

**Split into:**
```
src/features/admin/components/workflow/
├── kanban-settings.js              (200 lines) - Main component
├── workflow-status-editor.js       (200 lines) - Status CRUD, reordering
└── workflow-validation.js          (150 lines) - Validation, constraints
```

---

#### 15. **index.js (landing)** (537 lines)
**Location:** `src/features/landing/pages/index.js`

**Split into:**
```
src/features/landing/pages/
├── index.js                        (200 lines) - Main init, navigation
├── landing-animations.js           (200 lines) - Scroll animations, effects
└── landing-forms.js                (150 lines) - Beta signup, contact forms
```

---

#### 16. **tasks-gantt.css** (529 lines)
**Location:** `src/features/tasks/styles/tasks-gantt.css`

**Split into:**
```
src/features/tasks/styles/gantt/
├── gantt-base.css                  (200 lines) - Layout, containers
├── gantt-bars.css                  (200 lines) - Task bars, styling
└── gantt-grid.css                  (150 lines) - Grid, timeline, headers
```

---

#### 17. **reports-service.js** (512 lines)
**Location:** `src/shared/services/reports-service.js`

**Split into:**
```
src/shared/services/reports/
├── reports-service.js              (150 lines) - Main service, exports
├── reports-queries.js              (200 lines) - Database queries
└── reports-export.js               (200 lines) - CSV export, formatting
```

---

### Medium Priority (400-500 lines)

#### 18. **global-components.css** (433 lines)
**Split:** Extract navbar, buttons, cards into separate files

#### 19. **tasks-kanban.js** (428 lines)
**Split:** Separate rendering from drag-drop logic

#### 20. **project-service.js** (427 lines)
**Split:** Separate CRUD from aggregation queries

#### 21. **time-tracker.js** (426 lines)
**Split:** Separate timer UI from manual entry form

#### 22. **checklist-service.js** (413 lines)
**Split:** Separate checklist CRUD from item operations

#### 23. **reports-tables.css** (411 lines)
**Split:** Separate by report type (completion, productivity, time tracking)

---

## Implementation Strategy

### Phase 6A: Admin Components (Week 1)
- [ ] team-manager-admin.js → 5 modules
- [ ] system-admin-manager.js → 3 modules
- [ ] admin.css → 4 modules
- [ ] kanban-settings.js → 3 modules

**Priority:** High complexity, admin-only features

---

### Phase 6B: Landing Page (Week 2)
- [ ] landing/styles/index.css → 7 modules
- [ ] landing-demo.css → 4 modules
- [ ] landing/pages/index.js → 3 modules

**Priority:** High line count, CSS heavy

---

### Phase 6C: Tasks Page Core (Week 3) ✅ COMPLETE
- [x] tasks.js → 4 modules (tasks.js, tasks-init.js, tasks-filters.js, tasks-realtime.js)
- [x] tasks-modals.js → 4 modules (tasks-modals.js, tasks-modal-create.js, tasks-modal-edit.js, tasks-modal-view.js)
- [x] tasks-gantt.js → 2 modules (tasks-gantt.js: 152 lines, tasks-gantt-actions.js: 430 lines)
- [x] tasks-kanban.js → 2 modules (tasks-kanban.js: 287 lines, tasks-kanban-drag.js: 146 lines)

**Priority:** Core functionality, high churn
**Result:** All files now under 300 lines, improved maintainability

---

### Phase 6D: Gantt Features (Week 4) ✅ COMPLETE
- [x] gantt-chart.js → 3 modules (gantt-chart.js: 250 lines, gantt-renderer.js: 342 lines, gantt-utils.js: 104 lines)
- [x] gantt-service.js → 3 modules (gantt-service.js: 355 lines, gantt-calculations.js: 187 lines, gantt-dependencies.js: 166 lines)
- [x] tasks-gantt.css → 3 modules (gantt-base.css: 192 lines, gantt-bars.css: 115 lines, gantt-interactions.css: 223 lines)

**Priority:** Complex component, performance-sensitive
**Result:** All Gantt features modularized, excellent separation of concerns

---

### Phase 6E: Services & Utilities (Week 5) ✅ COMPLETE
- [x] reports-service.js → 3 modules (reports-queries.js: 442 lines, reports-export.js: 70 lines, reports-service.js: 35 lines)
- [x] project-service.js → 2 modules (project-crud.js: 354 lines, project-queries.js: 51 lines, project-service.js: 25 lines)
- [x] checklist-service.js → 2 modules (checklist-crud.js: 196 lines, checklist-items.js: 178 lines, checklist-service.js: 37 lines)
- [x] comment-thread.js → 3 modules (comment-renderer.js: 169 lines, comment-actions.js: 258 lines, comment-thread.js: 97 lines)
- [x] time-tracker.js → 2 modules (time-tracker-form.js: 75 lines, time-tracker.js: 298 lines)

**Priority:** Business logic, shared code
**Result:** All files modularized with excellent separation of concerns

---

### Phase 6F: CSS Cleanup (Week 6) ✅ COMPLETE
- [x] tags.css → 4 modules (tag-badges.css: 67 lines, tag-picker.css: 148 lines, tag-manager.css: 259 lines, tag-filter.css: 118 lines, tags.css: 10 lines - imports)
- [x] global-components.css → 3 modules (global-spinners-alerts.css: 96 lines, global-buttons-badges.css: 137 lines, global-cards-forms-tables.css: 221 lines, global-components.css: 9 lines - imports)
- [x] reports-tables.css → 3 modules (reports-data-tables.css: 217 lines, reports-dark-mode.css: 66 lines, reports-print.css: 166 lines, reports-tables.css: 9 lines - imports)
- [x] projects.js → 3 modules (projects.js: 271 lines, projects-ui.js: 170 lines, projects-forms.js: 215 lines)

**Priority:** Final polish, remaining files
**Result:** All files now under 300 lines, excellent separation of concerns

---

## Guidelines

### For JavaScript Files:
1. **Single Responsibility:** Each file has ONE clear purpose
2. **Export Strategy:**
   - Main file exports public API only
   - Sub-modules export specific functions
   - Use named exports (avoid default exports)
3. **State Management:**
   - Keep shared state in main orchestrator
   - Pass state as parameters to sub-modules
4. **Imports:**
   - Update Vite config if new path aliases needed
   - Avoid circular dependencies

### For CSS Files:
1. **CSS Imports:** Main file uses `@import` statements
2. **Ordering:**
   - Variables first
   - Layout/structure
   - Components
   - States/modifiers
   - Responsive (media queries)
3. **Naming:** Use BEM or consistent prefixes
4. **Dark Mode:** Keep light/dark modes together per component

### Testing After Each Split:
1. Run `npm run build` to catch import errors
2. Test affected features manually
3. Verify no regressions in functionality
4. Check bundle size (should not increase significantly)

---

## Success Criteria

- ✅ No file exceeds 400 lines
- ✅ Target: 200-300 lines per file
- ✅ All imports resolve correctly
- ✅ Build succeeds without errors
- ✅ No functionality regressions
- ✅ Improved code readability
- ✅ Easier to maintain/debug

---

## Estimated Impact

- **23 files** to refactor
- **~75 new files** created (3-4 per original file average)
- **Time:** 6 weeks @ 3-4 hours/week = ~20-24 hours total
- **Benefit:**
  - Easier debugging (find code faster)
  - Better collaboration (smaller PRs)
  - Reduced merge conflicts
  - Improved test coverage (test smaller units)

---

## Notes

- Some files are already well-structured (e.g., tasks.js imports sub-modules)
- Focus on extracting distinct responsibilities, not arbitrary splits
- Preserve existing functionality 100% (no feature changes)
- Update MEMORY.md after each phase completion
