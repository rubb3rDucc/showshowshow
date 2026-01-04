# Migration Notes

This document tracks the evolution of ShowShowShow's architecture, naming conventions, and planned migrations. It serves as a historical record and roadmap for understanding the current transitional state.

---

## Table of Contents
1. [Current State Summary](#current-state-summary)
2. [Naming Evolution](#naming-evolution)
3. [UI Component Visibility](#ui-component-visibility)
4. [Data Model Migration Plan](#data-model-migration-plan)
5. [Design System Evolution](#design-system-evolution)
6. [Timeline](#timeline)

---

## Current State Summary

**As of January 2026**, the codebase is in a transitional state:

| Aspect | Current Implementation | Canonical/Target |
|--------|----------------------|------------------|
| **Main UI Page** | Queue page (`Queue.tsx`) | Lineups page |
| **Database Tables** | `queue`, `schedule` | `lineups`, `scheduled_items` |
| **Data Model Docs** | Out of sync with implementation | `docs/DATA_MODEL.md` is authoritative |
| **Design System** | Quiet utility (implemented Jan 2026) | Quiet utility ✓ |
| **Schedule View** | Components exist but hidden from UI | Will be restored |

---

## Naming Evolution

### "Queue" → "Lineup"

**Historical Context:**
- **Original name**: "Queue" - a watchlist of content users want to watch
- **Interim state**: Still called "Queue" in current UI and database
- **Target name**: "Lineup" - a time-bounded viewing schedule (calendar software for media)

**Why the change?**
- "Queue" implies a simple ordered list
- "Lineup" better captures the calendar/scheduling nature
- Aligns with product philosophy: planning, not collecting

**Current status:**
- UI: Still displays as "Queue page"
- Database: Still uses `queue` table
- Components: `/frontend/src/pages/Queue.tsx`
- Target: Will rename to "Lineups" during data model migration

### "Schedule" → "Scheduled Items"

**Historical Context:**
- **Original**: "Schedule" - generated items from the queue
- **Current**: `schedule` table in database
- **Target**: `scheduled_items` - items within a lineup

**Why the change?**
- Better semantic clarity: items are "scheduled" within a "lineup"
- Matches canonical data model in `docs/DATA_MODEL.md`
- Separates the concept of a "lineup" (container) from "scheduled items" (contents)

---

## UI Component Visibility

### Currently Visible Pages

1. **Queue** (`/queue` route)
   - File: `/frontend/src/pages/Queue.tsx`
   - Primary user interface for scheduling
   - Features: drag-drop timeline, calendar view, generate schedule from queue
   - Status: **Active and visible**

2. **Library** (`/library` route)
   - User's tracked content with ratings/status
   - Status: **Active and visible**

3. **Browse** (`/browse` route)
   - Browse content by networks/genres
   - Status: **Active and visible**

4. **Search** (`/search` route)
   - Search for content to add
   - Status: **Active and visible**

### Currently Hidden Components

1. **Schedule View/Card Components**
   - Files:
     - `/frontend/src/components/schedule/ScheduleCard.tsx`
     - `/frontend/src/components/schedule/ScheduleView.tsx`
     - `/frontend/src/components/schedule/ScheduleHeader.tsx`
   - Purpose: Display scheduled items in a list/card format
   - Status: **Components exist and are functional, but removed from navigation**
   - Why hidden: Temporarily removed during UI restructuring
   - When restored: After data model migration to lineups/scheduled_items

2. **Home/Dashboard Schedule Display**
   - File: `/frontend/src/pages/Home.tsx`
   - References ScheduleView internally
   - Status: May show schedule view but not primary navigation destination

---

## Data Model Migration Plan

### Phase 1: Current State (Interim)

**Database Schema:**
```sql
-- Current implementation
queue (
  id, user_id, content_id, season, episode,
  position, synced, created_at
)

schedule (
  id, user_id, content_id, season, episode,
  scheduled_time, duration, source_type,
  source_id, watched, synced, timezone_offset,
  created_at
)
```

**Semantics:**
- `queue` = User's watchlist in order
- `schedule` = Generated time-based viewing plan
- Works but doesn't match product philosophy documentation

### Phase 2: Target State (Canonical)

**Database Schema** (from `docs/DATA_MODEL.md`):
```sql
-- Target implementation
lineups (
  id, user_id, name, state, timezone,
  auto_reschedule_enabled, created_at, updated_at
)

scheduled_items (
  id, lineup_id, user_id, content_id,
  scheduled_start, scheduled_end,
  source, auto_reason_code, auto_reason_text,
  status, watched_at, created_at, updated_at
)

watch_events (
  id, user_id, content_id, watched_at,
  source, lineup_id, scheduled_item_id,
  created_at
)

automation_action_log (
  id, user_id, lineup_id, action_type,
  target_scheduled_item_id, reason_code,
  reason_text, created_at
)
```

**Key Semantic Distinctions:**
1. **Intent vs Reflection**:
   - Lineups + scheduled_items = explicit user intent (participates in accountability)
   - Manual watch events = reflection only (does NOT participate in accountability)

2. **Multiple Lineups**:
   - Users can have multiple lineups (e.g., "Weeknight Anime", "Weekend Movies")
   - Free tier: 1 lineup
   - Pro tier: Multiple lineups

3. **Automation Transparency**:
   - `source` field: 'manual' | 'auto'
   - Auto actions logged with reason codes
   - Users always know what the system did and why

4. **Provenance Tracking**:
   - Every action has a source
   - Auto-reschedule is opt-in per lineup
   - Deterministic and reversible

### Migration Strategy

**Option A: Big Bang Migration**
- Migrate all tables at once
- Rename routes and components simultaneously
- Requires careful coordination and testing
- Risk: Large surface area for bugs

**Option B: Phased Migration** (Recommended)
1. **Phase 1**: Add new tables alongside old ones
   - Create `lineups`, `scheduled_items`, `watch_events` tables
   - Populate from existing `queue` and `schedule` data
   - Keep old tables functioning

2. **Phase 2**: Dual-write period
   - Write to both old and new schemas
   - Read from new schema, fall back to old
   - Verify data consistency

3. **Phase 3**: Switch reads to new schema
   - Update all queries to use new tables
   - Keep dual-writes active for safety

4. **Phase 4**: Update UI
   - Rename "Queue" → "Lineups" in navigation
   - Restore Schedule view with new schema
   - Update all components

5. **Phase 5**: Cleanup
   - Remove old tables
   - Remove dual-write logic
   - Archive migration code

**Migration Script Checklist:**
- [ ] Create migration: `012_add_lineups_schema.ts`
- [ ] Migrate queue → lineups (create default lineup per user)
- [ ] Migrate schedule → scheduled_items (with source tracking)
- [ ] Create watch_events from schedule.watched entries
- [ ] Add automation_action_log table
- [ ] Update API routes to use new schema
- [ ] Update frontend components
- [ ] Update navigation/routing
- [ ] Test rollback procedure
- [ ] Deploy to staging
- [ ] Verify in production

---

## Design System Evolution

### Original Design (Pre-Jan 2026)

**Visual Characteristics:**
- 10 rotating pastel color schemes (yellow, pink, cyan, purple, blue, orange, green, rose, indigo, teal)
- Heavy 2px black borders
- Posters auto-animate to GIFs on hover
- Row numbers prominent
- Black badges with white text
- Jiggle animations for reordering
- Logo-spin animations
- Heavy decorative elements (drop shadows, hover transforms)

**Philosophy:**
- Expressive, colorful, retro/punk aesthetic
- High visual energy
- Attention-seeking elements

### Current Design: Quiet Utility (Jan 2026)

**Visual Characteristics:**
- Single accent color: `#646cff` (blue)
- Grayscale palette for all other elements
- 1px subtle borders (not 2px black)
- Static poster thumbnails (48×72px cards, 40×60px queue)
- No row numbers
- Time is visually dominant (36px bold)
- Outlined badges (no fills)
- Minimal animations (only functional: fade, transitions)
- No decorative effects

**Philosophy:**
- Calm, predictable, utilitarian
- Time is visually dominant in schedules
- Hierarchy via typography and spacing, not color/decoration
- Color encodes meaning only (not decoration)
- Empty space is meaningful

**Design Spec:**
- Document: `docs/QUIET_UTILITY_DESIGN_SPEC.md`
- Design tokens: `/frontend/src/styles/quiet-design-system.ts`

**Components Updated (Jan 2026):**
- ✅ ScheduleCard - Complete redesign
- ✅ ScheduleView - Removed header, added spacing
- ✅ ScheduleTimeline - Light theme, accent colors
- ✅ ScheduleBlock - Light background, watched state
- ✅ QueueItemCard - Subtle styling, smaller posters
- ✅ Global CSS - Removed jiggle/logo-spin animations

**Key Changes:**
| Element | Before | After |
|---------|--------|-------|
| Time display | 16-20px, competing with other elements | 36px bold, visually dominant |
| Poster size | 50×75px (prominent) | 40×60px queue, 48×72px cards (thumbnail) |
| Color schemes | 10 pastel colors rotating | Single #646cff accent + grayscale |
| Borders | 2px black, decorative | 1px #e5e7eb, subtle |
| Animations | GIF hovers, jiggle, logo-spin | Fade/transitions only (functional) |
| Row numbers | Yes, numbered 01, 02, 03... | Removed |
| Mark watched | No UI | Checkbox with fade to 30% opacity + grayscale |

---

## Timeline

### 2024 Q4
- Initial development with queue/schedule model
- Pastel color scheme design
- Schedule page active in navigation

### 2024 Late
- Schedule page temporarily removed from navigation
- Queue page becomes primary interface
- Discussion of renaming to "Lineup"
- `docs/DATA_MODEL.md` created with canonical model

### 2026 January
- Quiet utility design system implemented
- All schedule/queue components redesigned
- Mark watched functionality added
- Design system constants created (`quiet-design-system.ts`)
- Migration notes documented (this file)
- CLAUDE.md updated with current state context

### Future (Planned)
- Data model migration: queue/schedule → lineups/scheduled_items
- Restore schedule view with new schema
- Rename Queue → Lineups in UI
- Implement automation_action_log
- Implement watch_events separation
- Multiple lineups support
- Auto-reschedule per-lineup

---

## Why This Document Exists

**Problem**: The codebase evolved organically, but documentation didn't keep pace.

**Result**:
- Confusion between "queue" vs "lineup" terminology
- Hidden components that exist but aren't visible
- Data model mismatch between docs and implementation
- AI assistants (Claude Code) don't have context about transitional state

**Solution**: This document provides:
1. **Historical context** - Why things are the way they are
2. **Current state** - What's visible vs hidden, what's interim vs target
3. **Migration roadmap** - Clear path from current to target state
4. **Semantic clarity** - Explains the intent behind naming decisions

**Audience**:
- Future developers (human)
- AI coding assistants (Claude Code, Copilot, etc.)
- Product documentation
- Onboarding materials

---

## Related Documents

- **`CLAUDE.md`** - General codebase guidance for AI assistants
- **`docs/DATA_MODEL.md`** - Canonical data model (target state)
- **`docs/PRODUCT.md`** - Product philosophy and design principles
- **`docs/LLM_CONSTRAINTS.md`** - Constraints for AI assistants
- **`docs/QUIET_UTILITY_DESIGN_SPEC.md`** - Visual design specification

---

**Last Updated**: January 3, 2026
**Maintainer**: Project lead
**Status**: Living document - update as migrations progress
