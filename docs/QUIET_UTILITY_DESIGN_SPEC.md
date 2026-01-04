# Quiet Utility Design Specification: Schedule & Lineup Pages

## Overview

This document specifies the visual redesign of schedule and lineup pages to achieve "quiet utility" design philosophy. This is a **design specification only** - implementation will happen after data model migration to the canonical lineups/scheduled_items schema.

**User Confirmations:**
- ✓ Accent color: #646cff (current blue)
- ✓ Watched items: Stay visible at 30% opacity + grayscale
- ✓ Row numbers: Remove completely
- ✓ Scope: Design mockups only (no implementation yet)

---

## Design Principles (Constraints)

### Must Follow:
1. **Time is visually dominant** - Largest, boldest element in schedules
2. **Hierarchy via typography and spacing** - Not color or decoration
3. **One accent color** (#646cff) - Used only for meaningful states
4. **Posters must not dominate** - Small thumbnails, not prominent
5. **Empty space is meaningful** - Breathing room, not clutter
6. **No animations for attention** - Subtle, functional only
7. **No expressive UI** - Calm, predictable, utilitarian

---

## Current State Problems

### Visual Issues:
- **10 pastel colors** (yellow-200, pink-200, cyan-200, etc.) - violates single accent rule
- **Posters auto-animate to GIFs** on hover - attention-seeking behavior
- **Heavy 2px black borders** - decorative, not meaningful
- **Row numbers compete with time** for visual hierarchy
- **Badges use black fills** - expressive, not informational
- **Multiple visual weights** - time not clearly dominant

### Functional Gaps:
- **Mark watched has no UI** - Backend exists but no button
- **No visual feedback** for watched state
- **No fade/collapse** animation on completion

---

## Design Specification

### Color Palette

**Single Accent:**
```
#646cff (blue) - Use ONLY for:
  - Active/scheduled item borders (on hover)
  - Mark watched checkbox (hover + checked states)
  - Interactive element focus states
```

**Grayscale Palette:**
```
Backgrounds:
  - #ffffff (white) - Card backgrounds
  - #fafafa (gray-50) - Page background, timeline blocks

Borders:
  - #e5e7eb (gray-200) - Subtle 1px borders (not 2px black)

Text:
  - #111827 (gray-900) - Primary text (time, titles)
  - #6b7280 (gray-500) - Secondary text (episode info)
  - #9ca3af (gray-400) - Tertiary text (metadata, duration)

Watched State:
  - opacity: 0.3 - Faded watched items
  - filter: grayscale(100%) - Desaturated watched items
```

---

## Component Design Specs

### 1. ScheduleCard (List View)

**Desktop Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│  2:30 PM      The Mandalorian                      [img]    ○  │
│  —            S03E05 • The Pirate                  48x72        │
│  3:00 PM      TV Show • PG • 30 min                             │
└────────────────────────────────────────────────────────────────┘
   3 cols       6 cols                                2 cols  1 col
```

**Grid Layout:**
- Column 1 (3fr): Time block
- Column 2 (6fr): Content info
- Column 3 (2fr): Poster thumbnail
- Column 4 (1fr): Actions (mark watched)

**Typography Hierarchy:**

| Element | Size | Weight | Color | Example |
|---------|------|--------|-------|---------|
| Start time | 36px | 700 (bold) | #111827 | "2:30 PM" |
| End time | 36px | 700 (bold) | #111827 | "3:00 PM" |
| Duration separator | 36px | 400 (regular) | #9ca3af | "—" |
| Title | 20px | 500 (medium) | #111827 | "The Mandalorian" |
| Episode | 14px | 400 (regular) | #6b7280 | "S03E05 • The Pirate" |
| Metadata | 12px | 400 (regular) | #9ca3af | "TV Show • PG • 30 min" |

**Time Column Format:**
```
2:30 PM    ← Start time (bold, large)
—          ← Separator (light gray)
3:00 PM    ← End time (bold, large)
```

**Poster Treatment:**
- Size: 48px width × 72px height (small thumbnail)
- Border-radius: 4px
- Object-fit: cover
- Position: Right side, de-emphasized
- NO border
- NO GIF animation or hover effects
- Watched state: Apply grayscale filter

**Mark Watched Checkbox:**
```
Unchecked:
  - 24px × 24px circle
  - 2px border, #d1d5db (gray-300)
  - Transparent background

Hover:
  - Border color → #646cff (accent blue)
  - Smooth transition (200ms)

Checked:
  - Background → #646cff (accent blue)
  - White checkmark icon (14px)
  - Border color → #646cff
```

**Card Container:**
- Background: #ffffff (white)
- Border: 1px solid #e5e7eb
- Border-radius: 8px
- Padding: 16px
- Margin-bottom: 24px (breathing room)

**Watched State Styling:**
```css
.watched-card {
  opacity: 0.3;
  filter: grayscale(100%);
  transition: opacity 300ms ease, filter 300ms ease;
}
```

**Mobile Layout:**
```
┌──────────────────────────────┐
│  2:30 PM — 3:00 PM           │
│  The Mandalorian             │
│  S03E05 • The Pirate         │
│  [img] TV Show • PG • 30m ○  │
│  32x48                        │
└──────────────────────────────┘
```
- Vertical stack layout
- Time first (large, bold)
- Title + episode second
- Poster inline with metadata + checkbox

---

### 2. ScheduleTimeline (Calendar View)

**Timeline Block:**
```
┌────────────────────────────────────────────┐
│  The Mandalorian - S03E05 - The Pirate     │
│  2:30 PM - 3:00 PM • 30 min            [×] │
└────────────────────────────────────────────┘
```

**Block Styling:**
- Background: #fafafa (light gray, not dark #1A1B1E)
- Border: 1px solid #e5e7eb
- Border-radius: 8px
- Padding: 12px 14px
- Height: Calculated from duration (minute-level precision)
- Position: Absolute based on scheduled_time

**Typography:**
- Title: 14px / font-weight-500 / #111827
- Time range: 12px / font-weight-400 / #6b7280
- Duration: 12px / font-weight-400 / #9ca3af

**Poster (Optional):**
- If included: 32px circular avatar on left
- De-emphasized, not prominent

**Delete Button:**
- Visible only on hover
- Gray color (#9ca3af)
- Subtle icon (14px)

**Watched State:**
- Opacity: 0.3
- Filter: grayscale(100%)
- Background: #fafafa (no color change)

**Timeline Container:**
- Background: #fafafa
- Border: 1px solid #e5e7eb
- Height: 2880px (24 hours × 120px per hour)
- Grid lines: #e5e7eb (subtle, 1px)

**Hover Indicator:**
- Line color: #646cff (accent blue)
- Tooltip background: rgba(0,0,0,0.75)
- No box-shadow (keep simple)

---

### 3. ScheduleView (List Container)

**Layout:**
- Remove table header row (NO., IMG, TIME, TITLE, DUR labels)
- Cards are self-documenting
- Stack with 24px vertical spacing
- Page background: #fafafa

**Date Navigation:**
- Previous/Next day buttons: Subtle gray
- Date picker: Minimal, clean
- Timezone display: Small, gray text

---

### 4. QueueItemCard (Watchlist)

**Layout:**
```
┌─────────────────────────────────────────┐
│ [img]  The Mandalorian             [×]  │
│ 40x60  TV Show • 3 seasons • 24 eps     │
│        30 min episodes                  │
└─────────────────────────────────────────┘
```

**Poster:**
- Size: 40px × 60px (reduced from 50x75)
- Subtle, not prominent

**Styling:**
- Background: white
- Border: 1px solid #e5e7eb
- NO hover background change
- Badges: Outlined (border + text), not filled
- Episode expand: Subtle gray button

---

## Visual Comparison

### Before (Current):
```
[1] [LARGE POSTER] 2:30 PM The Mandalorian      30 min
     with GIF       —      S03E05                [DELETE]
     animation      3:00PM [FILM badge][PG badge]

    - 10 pastel colors rotating (yellow, pink, cyan...)
    - 2px black borders
    - Posters auto-animate to GIFs on hover
    - Badges black filled
    - Row numbers compete with time
    - Heavy, expressive aesthetic
```

### After (Quiet Utility):
```
2:30 PM      The Mandalorian                    [tiny    ○
—            S03E05 • The Pirate                poster]
3:00 PM      TV Show • PG • 30 min              48x72

    - Single accent color (#646cff) for interactions only
    - 1px subtle gray borders
    - Static poster thumbnails (no animation)
    - Outlined badges (no fill)
    - Time is largest, boldest element
    - Calm, predictable aesthetic
```

---

## Mark Watched Interaction Flow

**Step 1: Default State**
```
User sees unchecked circle (○) on right side of card
Card is at full opacity with color
```

**Step 2: Hover**
```
Checkbox border changes from gray to blue (#646cff)
Cursor changes to pointer
Transition: 200ms ease
```

**Step 3: Click**
```
Checkbox immediately shows filled blue with checkmark
Card begins fading to 30% opacity
Grayscale filter applies
API call initiated (optimistic update)
```

**Step 4: Completed**
```
Card remains in timeline at 30% opacity + grayscale
Timeline stays continuous (no gaps)
Item still visible but clearly completed
User can un-check to reverse action
```

**Animation Timing:**
- Opacity transition: 300ms ease
- Filter transition: 300ms ease
- Checkbox fill: 200ms ease
- No delays, feels instant

---

## Typography Scale

**Font Family:**
```
font-family: system-ui, Avenir, Helvetica, Arial, sans-serif
(Already implemented - no change needed)
```

**Size Scale:**
```
36px - Time (schedule cards)
20px - Title
14px - Episode info, timeline block titles
12px - Metadata, duration, timestamps
```

**Weight Scale:**
```
700 (bold)   - Time, primary emphasis
500 (medium) - Titles
400 (regular) - Body text, metadata
```

**Line Height:**
```
1.5 - Body text, readable
1.2 - Headings, compact
```

---

## Spacing Scale

**Card Spacing:**
```
24px - Between cards (breathing room)
16px - Card padding (internal)
12px - Between text lines within card
8px - Between metadata items (episode • duration)
```

**Layout Spacing:**
```
32px - Page margins
24px - Section gaps
16px - Component gaps
```

---

## Border & Radius

**Borders:**
```
1px solid #e5e7eb - Default card/container borders (NOT 2px)
2px solid #646cff - Checkbox hover/focus (functional, not decorative)
```

**Border Radius:**
```
8px - Cards, timeline blocks (subtle rounding)
4px - Posters (minimal rounding)
50% - Checkboxes (perfect circles)
```

---

## Animations (Minimal)

**Allowed:**
```css
/* Fade for watched state */
transition: opacity 300ms ease, filter 300ms ease;

/* Checkbox interaction */
transition: border-color 200ms ease, background-color 200ms ease;

/* Button focus */
transition: border-color 200ms ease;
```

**Forbidden:**
```
❌ @keyframes jiggle (delete this)
❌ @keyframes logo-spin (delete this)
❌ GIF auto-loading on hover
❌ Hover elevation transforms (translateY)
❌ Drop shadow filters on hover
❌ Auto-play anything
```

---

## Accessibility

**Color Contrast:**
- Primary text (#111827) on white: 16.1:1 (AAA)
- Secondary text (#6b7280) on white: 4.5:1 (AA)
- Accent (#646cff) on white: 4.5:1 (AA)

**Keyboard Navigation:**
- Checkbox: Focusable with Tab
- Focus ring: 2px solid #646cff with 2px offset
- Enter/Space: Toggle watched state
- Arrow keys: Navigate between cards

**Screen Readers:**
- Checkbox: aria-label="Mark as watched: {title}"
- Watched state: aria-checked="true" / "false"
- Time: aria-label="{start} to {end}, {duration} minutes"

---

## Responsive Breakpoints

**Mobile (< 768px):**
- Vertical stack layout
- Time first (large)
- Poster inline with metadata
- Checkbox remains accessible

**Tablet (768px - 1024px):**
- Grid layout with smaller columns
- May collapse poster column

**Desktop (> 1024px):**
- Full grid layout as specified
- Maximum content width: 1200px (centered)

---

## Files to Update (When Implementing)

### Remove Animations:
1. `/frontend/src/index.css` - Delete jiggle animation
2. `/frontend/src/App.css` - Delete logo-spin animation

### Component Redesigns:
3. `/frontend/src/components/schedule/ScheduleCard.tsx` - Complete redesign
4. `/frontend/src/components/schedule/ScheduleView.tsx` - Remove header, update spacing
5. `/frontend/src/components/queue/calendar/ScheduleTimeline.tsx` - Color updates
6. `/frontend/src/components/queue/calendar/ScheduleBlock.tsx` - Light theme, watched state
7. `/frontend/src/components/queue/QueueItemCard.tsx` - Subtle styling

### New Files:
8. `/frontend/src/styles/quiet-design-system.ts` - Design tokens (optional but recommended)

---

## Success Criteria

**Visual:**
- [ ] Time is ≥ 2x larger than title text
- [ ] Only #646cff used as accent (no other colors)
- [ ] Posters ≤ 48x72px (thumbnail size)
- [ ] Borders ≤ 1px (not 2px)
- [ ] Zero auto-playing animations
- [ ] Empty space creates breathing room

**Functional:**
- [ ] Mark watched button visible and clickable
- [ ] Watched items fade to 30% + grayscale
- [ ] Timeline remains continuous (no gaps)
- [ ] Keyboard navigation works
- [ ] Screen reader accessible

**Philosophical:**
- [ ] Achieves "quiet utility" aesthetic
- [ ] Time is visually dominant
- [ ] Hierarchy clear at a glance
- [ ] Calm, not expressive
- [ ] No cognitive noise

---

## Implementation Notes (For Future)

**When implementing:**
1. Wait for data model migration (queue/schedule → lineups/scheduled_items)
2. Implement all changes at once (not phased) for design consistency
3. Test thoroughly on all breakpoints
4. Verify accessibility with keyboard and screen reader
5. Keep git history clean for easy rollback if needed
6. Consider feature flag for gradual rollout (optional)

**Do NOT implement until:**
- Canonical data model (lineups) is in place
- User approves these design mockups
- Timeline view architecture is finalized

---

## Appendix: Design Token Reference

```typescript
// /frontend/src/styles/quiet-design-system.ts
export const QuietDesign = {
  colors: {
    accent: '#646cff',
    gray: {
      50: '#fafafa',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      900: '#111827',
    },
    white: '#ffffff',
  },
  typography: {
    sizes: {
      time: '36px',
      title: '20px',
      body: '14px',
      metadata: '12px',
    },
    weights: {
      bold: 700,
      medium: 500,
      regular: 400,
    },
    lineHeights: {
      compact: 1.2,
      normal: 1.5,
    },
  },
  spacing: {
    cardGap: '24px',
    cardPadding: '16px',
    sectionGap: '32px',
    textGap: '12px',
  },
  borders: {
    radius: {
      card: '8px',
      poster: '4px',
      circle: '50%',
    },
    width: {
      default: '1px',
      focus: '2px',
    },
  },
  transitions: {
    fast: '200ms ease',
    normal: '300ms ease',
  },
};
```

---

**End of Design Specification**
