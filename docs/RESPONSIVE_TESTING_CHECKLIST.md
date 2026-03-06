# Responsive Web App Testing Checklist

**Date**: February 28, 2026  
**Status**: Ready for Testing

## Overview

This checklist covers all testing required for the responsive web app implementation. Complete each section and mark items as tested.

## Pre-Testing Setup

### Development Environment
- [ ] Install dependencies: `cd apps/web && npm install`
- [ ] Start dev server: `npm run dev`
- [ ] Verify app loads at http://localhost:5173

### Production Build
- [ ] Build app: `npm run build`
- [ ] Preview build: `npm run preview`
- [ ] Verify app loads at http://localhost:4173

## Desktop Testing (≥1025px)

### Layout
- [ ] Sidebar visible on left side
- [ ] Header at top with logo and user info
- [ ] Main content area fills remaining space
- [ ] Footer at bottom
- [ ] No horizontal scrolling

### Navigation
- [ ] All sidebar links work
- [ ] Active link highlighted
- [ ] "Manage Plex Playlists" section expands/collapses
- [ ] Nested links work correctly
- [ ] Hover states work on all links

### Responsive Behavior
- [ ] Layout unchanged from original design
- [ ] No mobile nav visible
- [ ] All features accessible
- [ ] Multi-column layouts work

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Tablet Testing (769-1024px)

### Layout
- [ ] Sidebar visible (or mobile nav, depending on size)
- [ ] Content adapts to screen width
- [ ] Touch targets comfortable size
- [ ] No horizontal scrolling

### Navigation
- [ ] Navigation works correctly
- [ ] Links easy to tap
- [ ] Active states visible

### Orientation
- [ ] Portrait mode works
- [ ] Landscape mode works
- [ ] Smooth transition between orientations

### Devices to Test
- [ ] iPad (Safari)
- [ ] iPad Pro (Safari)
- [ ] Android tablet (Chrome)

## Mobile Testing (≤768px)

### Layout
- [ ] Sidebar hidden
- [ ] Hamburger menu visible in header
- [ ] Content stacked vertically
- [ ] No horizontal scrolling
- [ ] Safe area insets respected (notched devices)

### Hamburger Menu
- [ ] Icon visible in header (left side)
- [ ] Icon animates when tapped (3 lines → X)
- [ ] Menu slides in from left (280px wide)
- [ ] Overlay backdrop appears
- [ ] Tapping overlay closes menu
- [ ] Menu closes when navigating
- [ ] Body scroll locked when menu open
- [ ] Smooth animations (no jank)

### Navigation
- [ ] All links accessible in mobile menu
- [ ] "Manage Plex Playlists" section works
- [ ] Active link highlighted
- [ ] Links easy to tap (44px minimum)

### Touch Targets
- [ ] All buttons at least 44px tall
- [ ] Links easy to tap
- [ ] No accidental taps
- [ ] Comfortable spacing between elements

### Forms & Inputs
- [ ] Inputs don't cause zoom (16px font size)
- [ ] Keyboard doesn't cover inputs
- [ ] Submit buttons accessible
- [ ] Validation messages visible

### Typography
- [ ] Text readable without zooming
- [ ] Headings appropriately sized
- [ ] Line height comfortable
- [ ] No text overflow

### Orientation
- [ ] Portrait mode works
- [ ] Landscape mode works
- [ ] Smooth transition between orientations
- [ ] Menu adapts to orientation

### Devices to Test
- [ ] iPhone (Safari) - various models
- [ ] Android phone (Chrome) - various models
- [ ] Small phone (<375px width)
- [ ] Large phone (>414px width)

## PWA Testing

### Installation - iOS

#### iPhone/iPad (Safari)
- [ ] Open app in Safari
- [ ] Share button visible
- [ ] "Add to Home Screen" option available
- [ ] Tap "Add to Home Screen"
- [ ] Icon appears on home screen
- [ ] Icon has correct image
- [ ] Tap icon to launch
- [ ] App opens in full-screen mode
- [ ] No Safari UI visible
- [ ] Status bar styled correctly

#### Behavior
- [ ] App stays in full-screen when navigating
- [ ] Links open in app (not Safari)
- [ ] External links open in Safari
- [ ] App can be closed and reopened
- [ ] State persists between sessions

### Installation - Android

#### Phone/Tablet (Chrome)
- [ ] Open app in Chrome
- [ ] Install prompt appears (or menu option)
- [ ] Tap "Install" or menu → "Install app"
- [ ] Icon appears in app drawer
- [ ] Icon has correct image
- [ ] Tap icon to launch
- [ ] App opens in full-screen mode
- [ ] No browser UI visible
- [ ] Status bar styled correctly

#### Behavior
- [ ] App stays in full-screen when navigating
- [ ] Links open in app (not Chrome)
- [ ] External links open in Chrome
- [ ] App can be closed and reopened
- [ ] State persists between sessions

### Installation - Desktop

#### Chrome/Edge
- [ ] Open app in browser
- [ ] Install icon visible in address bar
- [ ] Click install icon
- [ ] Install dialog appears
- [ ] Click "Install"
- [ ] App opens in standalone window
- [ ] App icon in Start Menu/Applications
- [ ] App can be launched from icon
- [ ] Window has correct title
- [ ] Window has correct icon

#### Behavior
- [ ] App stays in standalone window
- [ ] Links open in app window
- [ ] External links open in browser
- [ ] App can be closed and reopened
- [ ] State persists between sessions

### Service Worker

#### Registration
- [ ] Service worker registers (check console)
- [ ] No errors in console
- [ ] Service worker active (check DevTools)

#### Caching
- [ ] Assets cached on first load
- [ ] Subsequent loads faster
- [ ] Offline page loads (cached)
- [ ] API requests work online
- [ ] API requests fail gracefully offline

#### Updates
- [ ] Deploy new version
- [ ] Service worker detects update
- [ ] Update prompt appears
- [ ] User can reload to update
- [ ] New version loads after reload
- [ ] Old cache cleared

### Offline Functionality
- [ ] Load app while online
- [ ] Turn off network
- [ ] Navigate to cached pages (work)
- [ ] Navigate to uncached pages (fallback)
- [ ] API requests fail gracefully
- [ ] Turn on network
- [ ] API requests work again

## Functional Testing

### All Pages Work on Mobile
- [ ] Login page
- [ ] Dashboard page
- [ ] Import page
- [ ] Generate mixes page
- [ ] Playlists page
- [ ] Edit playlists page
- [ ] Share playlists page
- [ ] Backup & restore page
- [ ] Missing tracks page
- [ ] Schedules page
- [ ] Settings page
- [ ] Admin page (if admin)

### Features Work on Mobile
- [ ] Login with Plex
- [ ] View playlists
- [ ] Import playlist
- [ ] Generate mix
- [ ] Edit playlist
- [ ] Share playlist
- [ ] Backup/restore
- [ ] View missing tracks
- [ ] Create schedule
- [ ] Update settings
- [ ] Admin functions (if admin)

## Performance Testing

### Load Times
- [ ] First load <3s (3G)
- [ ] Subsequent loads <1s (cached)
- [ ] Time to interactive <2s

### Animations
- [ ] Menu slide smooth (60fps)
- [ ] No jank or stuttering
- [ ] Transitions smooth
- [ ] Scrolling smooth

### Memory
- [ ] No memory leaks
- [ ] App doesn't crash
- [ ] Stable over time

### Battery
- [ ] No excessive battery drain
- [ ] App doesn't keep device awake

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab through all elements
- [ ] Focus visible
- [ ] Enter/Space activate buttons
- [ ] Escape closes menu

### Screen Reader
- [ ] All elements announced
- [ ] Buttons have labels
- [ ] Links have text
- [ ] Images have alt text

### Color Contrast
- [ ] Text readable
- [ ] Sufficient contrast
- [ ] Works in bright light
- [ ] Works in dark environment

## Cross-Browser Testing

### Desktop
- [ ] Chrome 90+ (Windows)
- [ ] Chrome 90+ (macOS)
- [ ] Firefox 88+ (Windows)
- [ ] Firefox 88+ (macOS)
- [ ] Safari 14+ (macOS)
- [ ] Edge 90+ (Windows)

### Mobile
- [ ] Safari (iOS 14+)
- [ ] Safari (iOS 15+)
- [ ] Safari (iOS 16+)
- [ ] Chrome (Android 8+)
- [ ] Chrome (Android 10+)
- [ ] Chrome (Android 12+)
- [ ] Samsung Internet
- [ ] Firefox (Android)

## Edge Cases

### Network Conditions
- [ ] Slow 3G
- [ ] Fast 3G
- [ ] 4G
- [ ] WiFi
- [ ] Offline
- [ ] Intermittent connection

### Screen Sizes
- [ ] 320px width (iPhone SE)
- [ ] 375px width (iPhone 12)
- [ ] 414px width (iPhone 12 Pro Max)
- [ ] 768px width (iPad portrait)
- [ ] 1024px width (iPad landscape)
- [ ] 1920px width (desktop)
- [ ] 2560px width (large desktop)

### Zoom Levels
- [ ] 100% zoom
- [ ] 125% zoom
- [ ] 150% zoom
- [ ] 200% zoom

### Orientation Changes
- [ ] Portrait → Landscape
- [ ] Landscape → Portrait
- [ ] Multiple rapid changes
- [ ] Menu open during change

## Bug Tracking

### Issues Found
| # | Description | Severity | Device | Browser | Status |
|---|-------------|----------|--------|---------|--------|
| 1 |             |          |        |         |        |
| 2 |             |          |        |         |        |
| 3 |             |          |        |         |        |

### Severity Levels
- **Critical**: App unusable
- **High**: Major feature broken
- **Medium**: Minor feature broken
- **Low**: Cosmetic issue

## Sign-Off

### Desktop Testing
- [ ] All tests passed
- [ ] No critical issues
- **Tested by**: _______________
- **Date**: _______________

### Tablet Testing
- [ ] All tests passed
- [ ] No critical issues
- **Tested by**: _______________
- **Date**: _______________

### Mobile Testing
- [ ] All tests passed
- [ ] No critical issues
- **Tested by**: _______________
- **Date**: _______________

### PWA Testing
- [ ] All tests passed
- [ ] No critical issues
- **Tested by**: _______________
- **Date**: _______________

### Final Approval
- [ ] All platforms tested
- [ ] All critical issues resolved
- [ ] Ready for production
- **Approved by**: _______________
- **Date**: _______________

---

## Notes

Use this section for additional notes, observations, or issues that don't fit in the checklist above.

---

**Status**: Ready for Testing  
**Last Updated**: February 28, 2026
