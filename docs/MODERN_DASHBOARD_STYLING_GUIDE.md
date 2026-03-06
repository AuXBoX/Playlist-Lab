# Modern Dashboard Styling Guide

This guide provides all the CSS classes and styling patterns for the dark modern dashboard design.

## Color Palette

```css
--background: #1f1f1f       /* Main background */
--surface: #2c2c2c          /* Cards, panels */
--surface-hover: #3a3a3a    /* Hover states */
--sidebar-bg: #1f1f1f       /* Sidebar background */
--text-primary: #ffffff     /* Primary text */
--text-secondary: #b0b0b0   /* Secondary text, descriptions */
--border: #3a3a3a           /* Borders */
--primary-color: #5b9bd5    /* Primary brand color */
--primary-hover: #4a8bc2    /* Primary hover state */
```

## Layout Components

### Page Container
```jsx
<div className="page-container">
  <div className="page-header">
    <h1 className="page-title">Page Title</h1>
    <p className="page-description">Page description text</p>
  </div>
  {/* Content */}
</div>
```

### Section
```jsx
<div className="section">
  <h2 className="section-title">Section Title</h2>
  {/* Section content */}
</div>
```

## Navigation

### Tab Buttons (Source Selection)
```jsx
<div className="tab-buttons">
  <button className="tab-button active">Spotify</button>
  <button className="tab-button">Deezer</button>
  <button className="tab-button">YouTube Music</button>
</div>
```

Or use the ImportPage specific styling:
```jsx
<div className="source-tabs">
  <button className="source-tab active">
    <span className="source-tab-icon">🎵</span>
    Spotify
  </button>
  <button className="source-tab">
    <span className="source-tab-icon">🎧</span>
    Deezer
  </button>
</div>
```

## Cards

### Basic Card
```jsx
<div className="card">
  <h3>Card Title</h3>
  <p>Card content</p>
</div>
```

### Playlist Card
```jsx
<div className="playlist-card">
  <div className="playlist-card-header">
    <img src="cover.jpg" className="playlist-card-cover" alt="Cover" />
    <div className="playlist-card-info">
      <h3 className="playlist-card-title">Playlist Name</h3>
      <p className="playlist-card-meta">50 tracks</p>
    </div>
  </div>
  <p className="playlist-card-description">
    Playlist description text
  </p>
  <div className="playlist-card-actions">
    <button className="playlist-card-button playlist-card-button-primary">
      Import
    </button>
    <button className="playlist-card-button playlist-card-button-secondary">
      Preview
    </button>
  </div>
</div>
```

### Card Grid
```jsx
<div className="grid-2">  {/* or grid-3, grid-4 */}
  <div className="card">Card 1</div>
  <div className="card">Card 2</div>
  <div className="card">Card 3</div>
</div>
```

Or use the playlists-specific grid:
```jsx
<div className="playlists-grid">
  <div className="playlist-card">...</div>
  <div className="playlist-card">...</div>
</div>
```

## Forms

### Form Group
```jsx
<div className="form-group">
  <label className="form-label">Label Text</label>
  <input type="text" className="input" placeholder="Enter text..." />
  <span className="form-hint">Helper text goes here</span>
</div>
```

### Form Section (ImportPage)
```jsx
<div className="import-form">
  <div className="form-section">
    <label className="form-label">Playlist URL</label>
    <input 
      type="text" 
      className="form-input" 
      placeholder="https://..." 
    />
    <span className="form-hint">Paste your playlist URL here</span>
  </div>
</div>
```

### Select Dropdown
```jsx
<select className="input">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

## Buttons

### Primary Button
```jsx
<button className="btn btn-primary">
  Primary Action
</button>
```

### Secondary Button
```jsx
<button className="btn btn-secondary">
  Secondary Action
</button>
```

### Small Button
```jsx
<button className="btn btn-primary btn-small">
  Small Button
</button>
```

### Button with Icon
```jsx
<button className="btn btn-primary">
  <span>🎵</span>
  Import Playlist
</button>
```

## Badges

```jsx
<span className="badge badge-primary">Primary</span>
<span className="badge badge-success">Success</span>
<span className="badge badge-warning">Warning</span>
<span className="badge badge-error">Error</span>
```

## States

### Loading Spinner
```jsx
<div className="loading-container">
  <div className="loading-spinner"></div>
  <p className="loading-text">Loading...</p>
</div>
```

Or use the simple spinner:
```jsx
<div className="spinner"></div>
```

### Empty State
```jsx
<div className="empty-state">
  <div className="empty-state-icon">📭</div>
  <h3 className="empty-state-title">No Items Found</h3>
  <p className="empty-state-description">
    There are no items to display at this time.
  </p>
  <button className="btn btn-primary">Add Item</button>
</div>
```

### Error Message
```jsx
<div className="error-message">
  Error message text goes here
</div>
```

### Success Message
```jsx
<div className="success-message">
  Success message text goes here
</div>
```

### Progress Bar (ImportPage)
```jsx
<div className="import-progress">
  <div className="progress-header">
    <img src="cover.jpg" className="progress-cover" alt="Cover" />
    <div className="progress-info">
      <h3 className="progress-title">Importing Playlist</h3>
      <p className="progress-subtitle">Processing tracks...</p>
    </div>
  </div>
  <div className="progress-bar-container">
    <div className="progress-bar" style={{ width: '60%' }}></div>
  </div>
  <p className="progress-text">30 of 50 tracks processed</p>
</div>
```

## Utility Classes

### Flexbox
```jsx
<div className="flex items-center justify-between gap-2">
  <span>Left</span>
  <span>Right</span>
</div>

<div className="flex flex-col gap-3">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

### Spacing
```jsx
<div className="mt-4 mb-2">  {/* margin-top: 2rem, margin-bottom: 1rem */}
  Content
</div>

<div className="p-3">  {/* padding: 1.5rem */}
  Content
</div>
```

Available spacing: `mt-1` through `mt-4`, `mb-1` through `mb-4`, `p-1` through `p-4`

### Divider
```jsx
<div className="divider"></div>
```

## Sidebar Navigation

The sidebar is automatically styled. Use these classes in your Sidebar component:

```jsx
<nav className="sidebar">
  <div className="sidebar-nav">
    <div className="sidebar-nav-top">
      <a href="/dashboard" className="sidebar-link sidebar-link-active">
        Dashboard
      </a>
      <a href="/playlists" className="sidebar-link">
        Playlists
      </a>
    </div>
    <div className="sidebar-nav-bottom">
      <a href="/settings" className="sidebar-link">
        Settings
      </a>
    </div>
  </div>
</nav>
```

## Responsive Design

All components are mobile-responsive by default. Key breakpoints:

- Mobile: `max-width: 768px`
- Tablet: `769px - 1024px`
- Desktop: `1025px+`

Mobile-specific utilities:
```jsx
<div className="mobile-only">Visible on mobile only</div>
<div className="desktop-only">Visible on desktop only</div>
<div className="hide-mobile">Hidden on mobile</div>
```

## Design Principles

1. **Rounded Corners**: Use 8px-12px border radius for modern look
2. **Subtle Shadows**: Layer shadows for depth (sm, md, lg)
3. **Consistent Spacing**: Use 0.5rem increments (0.5, 1, 1.5, 2rem)
4. **Hover Effects**: Add subtle transforms and shadow changes
5. **Transitions**: Use 0.2s ease for smooth interactions
6. **Color Contrast**: Ensure text is readable on dark backgrounds

## Example: Complete Import Page Structure

```jsx
import './ImportPage.css';

function ImportPage() {
  return (
    <div className="import-page">
      <div className="import-header">
        <h1 className="import-title">Import Playlists</h1>
        <p className="import-description">
          Import playlists from your favorite music services
        </p>
      </div>

      <div className="source-tabs">
        <button className="source-tab active">
          <span className="source-tab-icon">🎵</span>
          Spotify
        </button>
        <button className="source-tab">
          <span className="source-tab-icon">🎧</span>
          Deezer
        </button>
      </div>

      <div className="import-form">
        <div className="form-section">
          <label className="form-label">Playlist URL</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="https://open.spotify.com/playlist/..." 
          />
          <span className="form-hint">
            Paste your Spotify playlist URL here
          </span>
        </div>
        <button className="btn btn-primary">Import Playlist</button>
      </div>

      <div className="playlists-grid">
        <div className="playlist-card">
          <div className="playlist-card-header">
            <img src="cover.jpg" className="playlist-card-cover" />
            <div className="playlist-card-info">
              <h3 className="playlist-card-title">Top 50 Global</h3>
              <p className="playlist-card-meta">50 tracks</p>
            </div>
          </div>
          <p className="playlist-card-description">
            The most played songs globally
          </p>
          <div className="playlist-card-actions">
            <button className="playlist-card-button playlist-card-button-primary">
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## CSS Variables Reference

All available CSS variables:

```css
:root {
  /* Colors */
  --primary-color: #5b9bd5;
  --primary-hover: #4a8bc2;
  --primary-dark: #3a7aaf;
  --background: #1f1f1f;
  --surface: #2c2c2c;
  --surface-hover: #3a3a3a;
  --sidebar-bg: #1f1f1f;
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --border: #3a3a3a;
  --error: #e74c3c;
  --success: #27ae60;
  --warning: #f39c12;
  
  /* Layout */
  --sidebar-width: 240px;
  --header-height: 60px;
  --border-radius: 12px;
  
  /* Shadows */
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  --card-shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.4);
}
```

## Tips

1. Always use CSS variables for colors to maintain consistency
2. Add hover states to interactive elements
3. Use the card component for grouping related content
4. Implement loading and empty states for better UX
5. Test on mobile devices for responsive behavior
6. Use semantic HTML elements (nav, section, article, etc.)
7. Add transitions for smooth interactions
8. Maintain consistent spacing throughout the app
