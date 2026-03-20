# TemplateList Component

A React component that displays a list of saved mix templates with search, sorting, and action capabilities.

## Features

- **Display Templates**: Shows all saved mix templates with name, type, description, and metadata
- **Search**: Filter templates by name, description, or type
- **Sort**: Sort by recently used, name, or most used
- **Actions**: Load, generate, edit, and delete templates
- **Loading States**: Shows loading spinner while fetching data
- **Empty States**: Helpful messages when no templates exist or search returns no results
- **Error Handling**: Displays error messages with retry option
- **Responsive**: Works on desktop and mobile devices

## Usage

```tsx
import { TemplateList, type MixTemplate } from './components/TemplateList';

function MyPage() {
  const handleLoad = (template: MixTemplate) => {
    // Populate mix builder with template configuration
    console.log('Loading template:', template);
  };

  const handleGenerate = async (template: MixTemplate) => {
    // Generate mix from template
    console.log('Generating from template:', template);
  };

  const handleEdit = (template: MixTemplate) => {
    // Open edit modal
    console.log('Editing template:', template);
  };

  const handleDelete = (templateId: number) => {
    // Optional: Show success message
    console.log('Template deleted:', templateId);
  };

  return (
    <TemplateList
      onLoad={handleLoad}
      onGenerate={handleGenerate}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onLoad` | `(template: MixTemplate) => void` | No | Called when user clicks "Load" button |
| `onGenerate` | `(template: MixTemplate) => void` | No | Called when user clicks "Generate" button |
| `onEdit` | `(template: MixTemplate) => void` | No | Called when user clicks "Edit" button |
| `onDelete` | `(templateId: number) => void` | No | Called after template is successfully deleted |

## Types

### MixTemplate

```typescript
interface MixTemplate {
  id: number;
  name: string;
  description?: string;
  mixType: string;
  configuration: MixTemplateConfiguration;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  useCount: number;
}
```

### MixTemplateConfiguration

```typescript
interface MixTemplateConfiguration {
  mixType: 'artist' | 'album' | 'genre' | 'mood' | 'decade' | 'custom';
  trackCount: number;
  sortBy?: 'random' | 'rating' | 'playCount' | 'dateAdded';
  artistIds?: string[];
  albumIds?: string[];
  genres?: string[];
  moods?: string[];
  decades?: number[];
  customRules?: {
    includeGenres?: string[];
    excludeGenres?: string[];
    minRating?: number;
    maxRating?: number;
    yearRange?: { min: number; max: number };
    includeUnplayed?: boolean;
  };
  allowDuplicateArtists?: boolean;
  allowDuplicateAlbums?: boolean;
  maxTracksPerArtist?: number;
  maxTracksPerAlbum?: number;
}
```

## API Requirements

The component expects the following API endpoints to be available:

- `GET /api/mix-templates` - List all templates for the current user
- `DELETE /api/mix-templates/:id` - Delete a template

Response format for GET:
```json
{
  "templates": [
    {
      "id": 1,
      "name": "Chill Evening Mix",
      "description": "Relaxing tracks for evening",
      "mixType": "mood",
      "configuration": { ... },
      "createdAt": 1234567890,
      "updatedAt": 1234567890,
      "lastUsedAt": 1234567890,
      "useCount": 5
    }
  ]
}
```

## Styling

The component uses CSS custom properties from the app's design system:

- `--primary-color` - Primary brand color
- `--surface` - Card background
- `--border` - Border color
- `--text-primary` - Primary text color
- `--text-secondary` - Secondary text color
- `--text-muted` - Muted text color
- `--error` - Error color
- `--card-shadow` - Card shadow
- `--radius-md` - Border radius

## States

### Loading
Shows a spinner and "Loading templates..." message while fetching data.

### Error
Displays error message with a "Retry" button if the API request fails.

### Empty
Shows helpful message when:
- No templates exist: "No saved templates yet" with hint
- Search returns no results: "No templates match your search" with "Clear Search" button

### Loaded
Displays template cards in a responsive grid layout.

## Template Card

Each template card shows:
- Icon (based on mix type)
- Name and type
- Description (if available)
- Metadata (track count, artist count, etc.)
- Stats (use count, last used date)
- Action buttons (Load, Generate, Edit, Delete)

## Responsive Design

- Desktop: Grid layout with multiple columns
- Tablet: Fewer columns
- Mobile: Single column, stacked buttons

## Integration Example

See `TemplateList.example.tsx` for integration examples with GenerateMixesPage.

## Future Enhancements

- Drag and drop reordering
- Bulk actions (delete multiple)
- Template categories/folders
- Template export/import
- Template sharing
- Template preview modal
