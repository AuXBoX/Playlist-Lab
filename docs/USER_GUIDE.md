# Playlist Lab Web Server - User Guide

Welcome to Playlist Lab! This guide will help you get started with importing playlists, generating personalized mixes, and managing your music collection across Plex.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Server Setup](#server-setup)
4. [Importing Playlists](#importing-playlists)
5. [Generating Mixes](#generating-mixes)
6. [Managing Playlists](#managing-playlists)
7. [Scheduling](#scheduling)
8. [Missing Tracks](#missing-tracks)
9. [Discovery](#discovery)
10. [Settings](#settings)
11. [Mobile Apps](#mobile-apps)
12. [Migrating from Desktop App](#migrating-from-desktop-app)
13. [Troubleshooting](#troubleshooting)
14. [FAQ](#faq)

---

## Getting Started

### What is Playlist Lab?

Playlist Lab is a web application that helps you:
- Import playlists from Spotify, Apple Music, Deezer, and other services into Plex
- Generate personalized playlists based on your listening history
- Schedule automatic playlist updates
- Manage missing tracks that couldn't be matched
- Discover new music through charts and recommendations

### System Requirements

- **Plex Media Server**: Version 1.20 or later
- **Music Library**: At least one music library configured in Plex
- **Web Browser**: Chrome, Firefox, Safari, or Edge (latest versions)
- **Internet Connection**: Required for authentication and external service access

---

## Authentication

### First Time Login

1. Navigate to your Playlist Lab instance (e.g., `https://playlist-lab.yourdomain.com`)
2. Click **"Sign in with Plex"**
3. You'll be redirected to Plex.tv to authorize the application
4. Click **"Accept"** to grant Playlist Lab access to your Plex account
5. You'll be redirected back to Playlist Lab and automatically logged in

### What Permissions Does Playlist Lab Need?

Playlist Lab requires access to:
- Your Plex account information (username, email)
- Your Plex servers
- Your music libraries
- Ability to create and modify playlists

**Note**: Playlist Lab never stores your Plex password. Authentication uses secure OAuth tokens.

### Staying Logged In

Your session will remain active for 30 days. After that, you'll need to log in again.

### Logging Out

Click your username in the top right corner and select **"Logout"**.

---

## Server Setup

### Selecting Your Plex Server

After logging in for the first time:

1. Go to **Settings** → **Server**
2. Click **"Select Server"**
3. Choose your Plex server from the list
4. Select your **Music Library**
5. Click **"Save"**

### Multiple Servers

If you have multiple Plex servers, you can switch between them:

1. Go to **Settings** → **Server**
2. Click **"Change Server"**
3. Select a different server
4. Choose the music library to use

**Note**: Playlists and settings are tied to your account, not your server. You can access them from any server.

---

## Importing Playlists

### Supported Services

Playlist Lab can import playlists from:
- **Spotify**
- **Apple Music**
- **Deezer**
- **Tidal**
- **YouTube Music**
- **Amazon Music**
- **Qobuz**
- **ListenBrainz**
- **M3U Files**
- **CSV Files**

### How to Import a Playlist

#### From Spotify

1. Go to **Import** page
2. Select **"Spotify"** as the source
3. Paste the Spotify playlist URL (e.g., `https://open.spotify.com/playlist/...`)
4. Click **"Import"**
5. Wait for the matching process to complete
6. Review matched and unmatched tracks
7. Click **"Create Playlist"** to add it to Plex

#### From Other Services

The process is similar for all services:
1. Copy the playlist URL from the service
2. Select the service in Playlist Lab
3. Paste the URL
4. Click **"Import"**
5. Review and create

#### From a File

1. Go to **Import** page
2. Select **"File"** as the source
3. Click **"Choose File"** and select your M3U or CSV file
4. Click **"Import"**
5. Review and create

### Understanding Match Results

After importing, you'll see:

- **Matched Tracks** (Green): Successfully found in your Plex library
- **Unmatched Tracks** (Red): Not found in your library

**Match Score**: Each matched track shows a confidence score (0-100%). Higher is better.

### What Happens to Unmatched Tracks?

Unmatched tracks are:
1. Saved to the **Missing Tracks** list
2. Can be retried later after you add music to your library
3. Won't be added to the playlist initially

### Customizing Playlist Names

Before creating the playlist, you can:
1. Edit the playlist name
2. Add a prefix (configured in Settings)
3. Click **"Create Playlist"**

---

## Generating Mixes

Playlist Lab can generate personalized playlists based on your listening history.

### Types of Mixes

#### Weekly Mix
- **What it is**: Top tracks from your most-played artists
- **Best for**: Discovering favorites you might have forgotten
- **Settings**: Number of artists, tracks per artist

#### Daily Mix
- **What it is**: Recent plays + related tracks + rediscoveries
- **Best for**: Daily listening with variety
- **Settings**: Number of recent, related, and rediscovery tracks

#### Time Capsule
- **What it is**: Tracks you haven't played in a while
- **Best for**: Rediscovering old favorites
- **Settings**: How far back to look, max tracks per artist

#### New Music Mix
- **What it is**: Tracks from recently added albums
- **Best for**: Exploring new additions to your library
- **Settings**: Number of albums, tracks per album

### How to Generate a Mix

1. Go to **Generate** page
2. Select the mix type
3. (Optional) Customize settings
4. Click **"Generate"**
5. Wait for the mix to be created
6. The playlist will appear in your Plex library

### Generate All Mixes

Click **"Generate All"** to create all four mix types at once.

### Why Can't I Generate a Mix?

Common reasons:
- **Insufficient play history**: Listen to more music first
- **No recently added albums**: For New Music Mix
- **Empty library**: Add music to your Plex library

---

## Managing Playlists

### Viewing Your Playlists

Go to **Playlists** page to see all playlists created by Playlist Lab.

### Playlist Information

For each playlist, you can see:
- Name
- Source (Spotify, Deezer, Mix, etc.)
- Number of tracks
- Creation date
- Last updated

### Editing Playlists

1. Click on a playlist
2. Click **"Edit"**
3. Modify the name or tracks
4. Click **"Save"**

**Note**: Changes are synced to Plex immediately.

### Deleting Playlists

1. Click on a playlist
2. Click **"Delete"**
3. Confirm deletion

**Warning**: This permanently deletes the playlist from Plex.

### Refreshing Playlists

For imported playlists, you can refresh them to get updated tracks:

1. Click on a playlist
2. Click **"Refresh"**
3. Wait for the import process to complete

---

## Scheduling

Automate playlist updates and mix generation with schedules.

### Creating a Schedule

1. Go to **Schedules** page
2. Click **"New Schedule"**
3. Choose schedule type:
   - **Playlist Refresh**: Update an imported playlist
   - **Mix Generation**: Regenerate a mix
4. Select frequency:
   - Daily
   - Weekly
   - Fortnightly (every 2 weeks)
   - Monthly
5. Set start date
6. Click **"Create"**

### Managing Schedules

- **Edit**: Change frequency or start date
- **Delete**: Remove the schedule
- **View Next Run**: See when the schedule will execute next

### How Schedules Work

- Schedules run automatically in the background
- You'll see updated playlists in Plex
- Check the **Last Run** timestamp to verify execution

### Schedule Examples

**Weekly Spotify Playlist Refresh**:
- Type: Playlist Refresh
- Playlist: "Today's Top Hits"
- Frequency: Weekly
- Start Date: Monday

**Daily Mix Generation**:
- Type: Mix Generation
- Mix: Daily Mix
- Frequency: Daily
- Start Date: Today

---

## Missing Tracks

### What Are Missing Tracks?

Missing tracks are songs from imported playlists that couldn't be matched to your Plex library.

### Viewing Missing Tracks

1. Go to **Missing Tracks** page
2. Tracks are grouped by playlist
3. Each track shows:
   - Title
   - Artist
   - Album (if available)
   - Source playlist

### Why Tracks Go Missing

Common reasons:
- Track not in your library
- Different artist/title spelling
- Live/remix version mismatch
- Compilation vs. studio album

### Retrying Missing Tracks

After adding music to your library:

1. Go to **Missing Tracks** page
2. Select tracks to retry
3. Click **"Retry Matching"**
4. Successfully matched tracks will be added to the playlist

### Removing Missing Tracks

If you don't plan to add a track:

1. Select the track
2. Click **"Remove"**
3. The track is removed from the missing list

### Exporting Missing Tracks

Export to CSV to see what's missing:

1. Go to **Missing Tracks** page
2. Click **"Export to CSV"**
3. Open in Excel or Google Sheets

---

## Discovery

Explore popular music charts from various services.

### Available Charts

- Spotify Top 50 (Global and by country)
- Apple Music Top 100
- Deezer Charts
- Billboard Charts
- ARIA Charts (Australia)

### Importing Charts

1. Go to **Discovery** page
2. Browse available charts
3. Click **"Import"** on a chart
4. Review matched tracks
5. Create playlist

### Filtering Charts

Use the country filter to see charts specific to your region.

---

## Settings

### Matching Settings

Control how tracks are matched to your library:

#### Match Threshold
- **Lower** (0.5-0.7): More matches, less accurate
- **Higher** (0.8-1.0): Fewer matches, more accurate
- **Recommended**: 0.7

#### Text Processing
- **Strip Parentheses**: Remove text in (parentheses)
- **Strip Brackets**: Remove text in [brackets]
- **Ignore Featured Artists**: Match without "feat." artists
- **Ignore Remix Info**: Match without "Remix" in title

#### Preferences
- **Prefer Non-Compilation**: Favor studio albums over compilations
- **Penalize Live Versions**: Lower score for live recordings
- **Prefer Higher Rated**: Favor tracks with higher Plex ratings

### Mix Settings

Customize mix generation:

#### Weekly Mix
- **Top Artists**: How many artists to include (default: 5)
- **Tracks Per Artist**: Tracks from each artist (default: 10)

#### Daily Mix
- **Recent Tracks**: Recently played tracks (default: 10)
- **Related Tracks**: Similar tracks (default: 15)
- **Rediscovery Tracks**: Old favorites (default: 10)
- **Rediscovery Days**: How far back to look (default: 30)

#### Time Capsule
- **Track Count**: Total tracks (default: 50)
- **Days Ago**: Minimum age of tracks (default: 90)
- **Max Per Artist**: Limit per artist (default: 3)

#### New Music Mix
- **Album Count**: Recently added albums (default: 10)
- **Tracks Per Album**: Tracks from each album (default: 3)

### Playlist Prefixes

Add prefixes to imported playlists:
- Spotify: "🎵 "
- Apple Music: "🍎 "
- Deezer: "🎧 "

Enable/disable in Settings → Matching → Playlist Prefixes

---

## Mobile Apps

### iOS App

#### Installation
1. Download from the App Store
2. Open the app
3. Sign in with your Plex account
4. Select your server and library

#### Features
- Import playlists
- Generate mixes
- View and manage playlists
- Offline support (cached data)
- Native iOS gestures (swipe to delete, pull to refresh)

### Android App

#### Installation
1. Download from Google Play Store
2. Open the app
3. Sign in with your Plex account
4. Select your server and library

#### Features
- Import playlists
- Generate mixes
- View and manage playlists
- Offline support (cached data)
- Material Design UI

### Offline Mode

Mobile apps cache data for offline access:
- Playlist lists
- Missing tracks
- Settings

Actions performed offline are queued and synced when connection is restored.

---

## Migrating from Desktop App

### Exporting from Desktop App

1. Open the desktop Electron app
2. Go to **Settings** → **Backup & Restore**
3. Click **"Export Data"**
4. Save the JSON file

### Importing to Web App

1. Log in to the web app
2. Go to **Settings** → **Migration**
3. Click **"Import Desktop Data"**
4. Select the JSON file
5. Click **"Import"**
6. Wait for the import to complete

### What Gets Migrated?

- ✅ Matching settings
- ✅ Mix settings
- ✅ Playlist records
- ✅ Schedules
- ✅ Missing tracks
- ❌ Cached playlist data (will be re-scraped)

### After Migration

1. Verify your playlists appear in the web app
2. Check schedules are active
3. Review missing tracks
4. Test importing a new playlist

---

## Troubleshooting

### Can't Log In

**Problem**: Authentication fails or redirects don't work

**Solutions**:
1. Clear browser cookies and cache
2. Try a different browser
3. Verify Plex.tv is accessible
4. Check if popup blockers are interfering

### Playlists Not Appearing in Plex

**Problem**: Created playlists don't show up

**Solutions**:
1. Refresh your Plex library
2. Check the correct server is selected
3. Verify the playlist was created (check Playlists page)
4. Wait a few minutes for Plex to sync

### Import Fails

**Problem**: Playlist import errors or times out

**Solutions**:
1. Verify the URL is correct
2. Check if the playlist is public (not private)
3. Try again later (external service may be down)
4. Check your internet connection

### No Matches Found

**Problem**: All tracks show as unmatched

**Solutions**:
1. Verify music is in your Plex library
2. Check artist/title spelling in Plex
3. Lower the match threshold in Settings
4. Enable text processing options (strip parentheses, etc.)

### Mix Generation Fails

**Problem**: "Not enough play history" error

**Solutions**:
1. Listen to more music in Plex
2. Verify play history is being tracked
3. Check the correct library is selected
4. Try a different mix type

### Schedules Not Running

**Problem**: Scheduled tasks don't execute

**Solutions**:
1. Verify the schedule is active
2. Check the start date is in the past
3. Wait for the next scheduled time
4. Contact your administrator (server issue)

### Mobile App Won't Sync

**Problem**: Changes don't sync between devices

**Solutions**:
1. Check internet connection
2. Pull to refresh
3. Log out and log back in
4. Reinstall the app

---

## FAQ

### Is Playlist Lab free?

Yes, Playlist Lab is open source and free to use. You only need a Plex account and server.

### Does Playlist Lab work with Plex Pass?

Playlist Lab works with both free and Plex Pass accounts. Plex Pass is not required.

### Can multiple users use the same Playlist Lab instance?

Yes! Each user has their own account, playlists, and settings. Data is completely isolated.

### Does Playlist Lab download music?

No. Playlist Lab only creates playlists in Plex using music you already have in your library.

### How often are charts updated?

Charts are scraped daily at 2 AM server time. Cached data is used for 24 hours.

### Can I use Playlist Lab without a Plex server?

No. Playlist Lab requires a Plex Media Server with at least one music library.

### Is my data private?

Yes. Your playlists, settings, and listening history are private to your account. Administrators can see aggregate statistics but not individual user data.

### Can I self-host Playlist Lab?

Yes! Playlist Lab is open source. See the Deployment Guide for instructions.

### Does Playlist Lab support video playlists?

No. Playlist Lab is designed specifically for music playlists.

### Can I import my own M3U files?

Yes. Go to Import → File and upload your M3U file.

### How do I report a bug?

Open an issue on GitHub: https://github.com/your-org/playlist-lab/issues

### How do I request a feature?

Open a discussion on GitHub: https://github.com/your-org/playlist-lab/discussions

---

## Getting Help

### Documentation

- **API Documentation**: For developers integrating with Playlist Lab
- **Deployment Guide**: For administrators setting up Playlist Lab
- **Developer Guide**: For contributors

### Community

- **Discord**: https://discord.gg/playlist-lab
- **GitHub Discussions**: https://github.com/your-org/playlist-lab/discussions
- **Reddit**: r/PlaylistLab

### Support

- **Email**: support@playlist-lab.com
- **GitHub Issues**: https://github.com/your-org/playlist-lab/issues

---

## Tips and Tricks

### Improve Match Accuracy

1. Use consistent naming in Plex (enable "Prefer local metadata")
2. Lower match threshold for more matches
3. Enable text processing options
4. Use "Retry Matching" after adding music

### Organize Playlists

1. Use prefixes to identify sources
2. Create folders in Plex for different types
3. Use descriptive names

### Optimize Mix Generation

1. Listen to music regularly to build history
2. Rate tracks in Plex for better recommendations
3. Adjust mix settings to your preferences
4. Schedule daily/weekly regeneration

### Manage Missing Tracks

1. Export to CSV to see what's missing
2. Add missing albums to your library
3. Retry matching periodically
4. Remove tracks you don't plan to add

### Use Schedules Effectively

1. Schedule playlist refreshes weekly
2. Generate mixes daily for fresh content
3. Stagger schedules to avoid server load
4. Monitor last run times

---

**Last Updated**: January 2026  
**Version**: 1.0.0

Enjoy using Playlist Lab! 🎵
