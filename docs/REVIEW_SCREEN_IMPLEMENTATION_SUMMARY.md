# Import Review Screen - Implementation Summary

## Current Status
✅ Import flow now shows review screen (instead of auto-creating playlist)
✅ Basic table layout exists
✅ Matched/unmatched separation

## What Needs to Be Added

### 1. Enhanced Table Layout (Priority: HIGH)
**Current**: Simple list with title/artist
**Needed**: Full table like desktop app with:
- Drag handle column (⋮⋮ icon)
- Track number (#)
- Source title → Matched title (with arrow)
- Artist, Album, Format columns
- **Match Score column** (100%, 95%, etc.) - color coded
- Row click to open rematch modal

### 2. Drag and Drop Reordering (Priority: MEDIUM)
- HTML5 Drag and Drop API or library
- Visual feedback during drag
- Reorder tracks array in state

### 3. Manual Rematch Modal (Priority: HIGH)
- Click row to open modal
- Search input
- Results table
- Select new match
- Update track in list

### 4. Filter Controls (Priority: LOW)
- "Show unmatched only" checkbox at top
- Filter table display

### 5. Export Missing (Priority: LOW)
- Button to download unmatched tracks as CSV

## Implementation Order

1. **First**: Enhance table to show match scores and full details
2. **Second**: Add manual rematch modal with search
3. **Third**: Add drag-and-drop reordering
4. **Fourth**: Add filter checkbox
5. **Fifth**: Add export missing button

## Next Steps

Would you like me to:
A) Implement all features now (will be a large change)
B) Implement step-by-step, starting with enhanced table + match scores
C) Focus on just manual rematch first (most important feature)

Let me know and I'll proceed!
