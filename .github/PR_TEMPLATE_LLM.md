# Pull Request Template for LLMs

Use this template when creating pull requests for ShowShowShow. Fill in each section based on the changes made.

---

## PR Title Format

Use one of these prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `style:` - UI/styling changes
- `perf:` - Performance improvements
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

Example: `feat: Add network drag-and-drop reordering`

---

## PR Body Template

```markdown
## Summary
[1-3 sentences describing what this PR does and why]

## Major Features

### [Feature Name]
- **What it does**: [Brief description]
- **Key changes**:
  - [Change 1]
  - [Change 2]
  - [Change 3]

[Repeat for each major feature]

## Technical Changes

### Backend Changes
- **[File/Area]**: [Description of changes]

### Frontend Changes
- **[File/Area]**: [Description of changes]

### Database Changes
- **Migration**: [Migration file name or "None required"]
- **Schema changes**: [Description or "None"]

## Files Changed

### Backend
- `backend/src/routes/[file].ts`: [What changed]
- `backend/src/lib/[file].ts`: [What changed]

### Frontend
- `frontend/src/components/[file].tsx`: [What changed]
- `frontend/src/pages/[file].tsx`: [What changed]

## Testing Considerations

- [ ] Test [specific scenario 1]
- [ ] Test [specific scenario 2]
- [ ] Verify [behavior] works on mobile
- [ ] Test with and without [optional feature/config]

## Migration Notes

- **Database**: [Migration required/not required]
- **API**: [Backward compatible/Breaking changes]
- **Environment**: [New env vars needed]

## Screenshots/Notes

[Add screenshots for UI changes, or notes about non-obvious behavior]
```

---

## Example: Feature PR

```markdown
## Summary
Added drag-and-drop reordering for network cards on the Browse page. Order is persisted to the database and syncs across sessions.

## Major Features

### Network Drag-and-Drop
- **What it does**: Users can drag network cards to reorder them
- **Key changes**:
  - Added `sort_order` column to networks table
  - Created reorder API endpoint
  - Integrated @dnd-kit for drag handling
  - Optimistic UI updates for instant feedback

## Technical Changes

### Backend Changes
- **Database types**: Added `sort_order: number` to networks table type
- **API routes**:
  - Updated `GET /api/networks` to order by `sort_order`
  - Added `PATCH /api/networks/reorder` endpoint

### Frontend Changes
- **NetworkGrid**: Integrated @dnd-kit with SortableNetworkCard wrapper
- **API client**: Added `reorderNetworks()` function

### Database Changes
- **Migration**: `010_add_network_sort_order.ts`
- **Schema changes**: Added `sort_order INTEGER` to networks table

## Files Changed

### Backend
- `backend/src/db/types.ts`: Added sort_order type
- `backend/src/routes/networks.ts`: Added reorder endpoint
- `backend/src/migrations/010_add_network_sort_order.ts`: New migration

### Frontend
- `frontend/src/api/networks.ts`: Added reorderNetworks function
- `frontend/src/components/browse/NetworkGrid.tsx`: Added drag-drop support

## Testing Considerations

- [ ] Test drag-and-drop on desktop
- [ ] Test order persists after page refresh
- [ ] Test new networks appear at end
- [ ] Verify keyboard navigation works

## Migration Notes

- **Database**: Run `pnpm run migrate:up`
- **API**: Backward compatible
- **Environment**: No new env vars

## Screenshots/Notes

Networks can now be dragged horizontally to reorder.
```

---

## Example: Bug Fix PR

```markdown
## Summary
Fixed error handler exposing sensitive information in production error responses. Server errors now return generic messages while still logging full details.

## Changes

### Error Handler Updates
- 5xx errors return "An internal error occurred" in production
- 4xx errors still show user-friendly messages
- Validation details hidden in production
- Error codes preserved for client handling
- Full errors still logged server-side

### Security Improvements
- No sensitive data in error messages
- No stack traces exposed to clients
- PostHog tracking still captures full details

## Files Changed

### Backend
- `backend/src/plugins/error-handler.ts`: Sanitize production errors
- `backend/tests/unit/error-handler.test.ts`: Added 9 test cases

## Testing Considerations

- [ ] Test 5xx errors show generic message in production
- [ ] Test 4xx errors show helpful message
- [ ] Verify full details in development mode
- [ ] Check logs contain full error details

## Migration Notes

- **Database**: None
- **API**: Error response format unchanged
- **Environment**: None
```

---

## Guidelines for LLMs

1. **Be specific**: List actual file paths and function names
2. **Explain the "why"**: Not just what changed, but why
3. **Include testing**: Help reviewers know what to verify
4. **Note breaking changes**: Clearly mark any API/schema changes
5. **Keep it scannable**: Use headers, bullets, and checklists
6. **Link related docs**: Reference relevant documentation
