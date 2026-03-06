# Tray App Icon Guide

## Current Status

The tray app uses emoji indicators (🟢/🔴) in the tooltip and title to show server status. This works but isn't as visually clear as custom icons.

## Desired Icons

Create three .ico files with a playlist symbol and colored status indicator:

### 1. server-running.ico
- Playlist icon (♪ or music note with lines)
- Green dot/circle in corner
- Indicates: Server is running and healthy

### 2. server-stopped.ico
- Same playlist icon
- Red dot/circle in corner
- Indicates: Server is stopped or unreachable

### 3. server-starting.ico (optional)
- Same playlist icon
- Yellow/orange dot in corner
- Indicates: Server is starting up

## Icon Specifications

### Size Requirements
- 16x16 pixels (small tray icon)
- 32x32 pixels (standard tray icon)
- 48x48 pixels (large tray icon)
- 256x256 pixels (high DPI displays)

All sizes should be included in a single .ico file.

### Design Guidelines
- Simple, recognizable at small sizes
- High contrast for visibility
- Consistent style across all three icons
- Status indicator should be clearly visible

## How to Create Icons

### Option 1: Online Icon Generator (Easiest)

1. **Create Base Image**:
   - Use Canva, Figma, or similar tool
   - Create 256x256 canvas
   - Draw playlist symbol: ♪ ═══ or similar
   - Add colored circle (20% of icon size) in bottom-right corner

2. **Export as PNG**:
   - Export three versions (green, red, yellow dots)
   - Name them: running.png, stopped.png, starting.png

3. **Convert to ICO**:
   - Visit: https://convertio.co/png-ico/
   - Upload each PNG
   - Select "Multi-size ICO" option
   - Download the .ico files

### Option 2: GIMP (Free Software)

1. **Install GIMP**: https://www.gimp.org/downloads/

2. **Create Icon**:
   ```
   File → New → 256x256 pixels
   Background: Transparent
   ```

3. **Draw Playlist Symbol**:
   - Use text tool for ♪ symbol (size: 180px)
   - Or draw custom playlist icon
   - Add horizontal lines for playlist effect

4. **Add Status Indicator**:
   - Create new layer
   - Draw circle (50x50 pixels) in corner
   - Fill with color:
     - Green: #4CAF50
     - Red: #F44336
     - Yellow: #FFC107

5. **Export as ICO**:
   ```
   File → Export As → filename.ico
   Select "Compressed (PNG)" format
   Check all size options (16, 32, 48, 256)
   ```

6. **Repeat for each status** (green, red, yellow)

### Option 3: Hire a Designer

**Fiverr** ($5-20):
- Search: "windows tray icon design"
- Provide specifications above
- Request: "Playlist icon with green/red/yellow status indicators"
- Delivery: 1-3 days

**Upwork** ($20-50):
- More professional results
- Can request revisions
- Better for custom designs

## Icon Placement

Place the .ico files in the installation directory:

```
C:\Program Files\Playlist Lab Server\
  └── icons\
      ├── server-running.ico   (green indicator)
      ├── server-stopped.ico   (red indicator)
      └── server-starting.ico  (yellow indicator - optional)
```

The tray app will automatically use these icons if they exist.

## Testing Icons

After creating icons:

1. **Place icons in folder**:
   ```cmd
   mkdir "C:\Program Files\Playlist Lab Server\icons"
   copy server-*.ico "C:\Program Files\Playlist Lab Server\icons\"
   ```

2. **Restart tray app**:
   - Right-click tray icon → Exit
   - Start Menu → Playlist Lab Server

3. **Verify icons appear**:
   - Check tray icon changes with server status
   - Test at different DPI settings
   - Verify visibility on light/dark taskbars

## Fallback Behavior

If icon files don't exist, the tray app will:
1. Create empty placeholder files
2. Use emoji indicators (🟢/🔴) in tooltip/title
3. Continue functioning normally

The app works fine without custom icons - they're just a visual enhancement!

## Example Icon Designs

### Simple Design
```
┌─────────────┐
│   ♪ ═══     │  ← Playlist symbol
│             │
│          ●  │  ← Status dot (green/red/yellow)
└─────────────┘
```

### Detailed Design
```
┌─────────────┐
│   ♪         │  ← Music note
│   ═══       │  ← Playlist lines
│   ═══       │
│   ═══    ●  │  ← Status indicator
└─────────────┘
```

### Minimalist Design
```
┌─────────────┐
│             │
│    ♫ ●      │  ← Note + status in center
│             │
└─────────────┘
```

Choose a design that's clear at 16x16 pixels!

## Color Codes

Use these exact colors for consistency:

- **Green (Running)**: #4CAF50 or RGB(76, 175, 80)
- **Red (Stopped)**: #F44336 or RGB(244, 67, 54)
- **Yellow (Starting)**: #FFC107 or RGB(255, 193, 7)

## Resources

### Free Icon Tools
- GIMP: https://www.gimp.org/
- Inkscape: https://inkscape.org/
- Paint.NET: https://www.getpaint.net/

### Online Converters
- PNG to ICO: https://convertio.co/png-ico/
- ICO Editor: https://www.xiconeditor.com/

### Icon Inspiration
- Windows 11 Icons: https://www.figma.com/community/file/1085233862267970909
- Material Design Icons: https://fonts.google.com/icons

### Unicode Symbols
- ♪ (U+266A) - Eighth Note
- ♫ (U+266B) - Beamed Eighth Notes
- ♬ (U+266C) - Beamed Sixteenth Notes
- ═ (U+2550) - Box Drawing Double Horizontal

## Next Steps

1. Create the three icon files using one of the methods above
2. Place them in the `icons` folder
3. Rebuild the installer to include the icons
4. Test the new icons with the tray app

The tray app is already configured to use these icons - you just need to create them!
