# Simple Manager Guide

## Overview

The Simple Manager (`scripts/github-manager.bat`) is an easy-to-use tool for managing your Playlist Lab project. It uses plain English instead of technical Git terminology, making it accessible to everyone.

## Quick Start

```cmd
cd K:\Projects\Playlist Lab
scripts\github-manager.bat
```

## Features

### ✅ Automatic Checks
- Verifies Git is installed
- Checks Node.js and npm
- Confirms project is set up correctly

### 🎨 Color-Coded Interface
- Green: Success and safe operations
- Red: Errors and warnings
- Yellow: Important information
- Blue: Helpful tips

## Menu Options Explained

### EVERYDAY TASKS

#### [1] Save My Work
Saves all your changes and uploads them to GitHub.

**What it does**:
1. Shows you what changed
2. Asks you to describe your changes
3. Saves everything
4. Uploads to GitHub

**When to use**: After making changes to any files

**Example**:
```
Select: 1
Describe: "Fixed the login page bug"
Done! Your work is saved and uploaded.
```

#### [2] Get Latest Changes
Downloads the newest version from GitHub.

**What it does**:
1. Connects to GitHub
2. Downloads any new changes
3. Updates your local files

**When to use**: Start of each day, or before making changes

#### [3] What Changed?
Shows you what files you've modified.

**What it does**:
- Lists all files you've changed
- Shows new files
- Shows deleted files

**When to use**: Before saving your work, to review changes

### RELEASE A NEW VERSION

#### [4] Build Everything
Builds all installers and apps locally.

**What it does**:
1. Builds Windows installer
2. Builds macOS installer
3. Builds Linux packages
4. Builds desktop apps
5. Builds mobile apps (if EAS CLI installed)

**Time**: 10-30 minutes

**When to use**: Before creating a release, to test everything works

**Note**: This does NOT upload anything - it just builds locally

#### [5] Create New Version
Creates a new version and triggers automatic builds.

**What it does**:
1. Asks for version number (e.g., v2.0.1)
2. Asks what's new in this version
3. Creates the version tag
4. Uploads to GitHub
5. Automatically starts building everything
6. Creates a GitHub Release

**Time**: 30-45 minutes for builds to complete

**When to use**: When you're ready to release a new version

**Example**:
```
Select: 5
Version: v2.0.1
What's new: Bug fixes and performance improvements
Confirm: Y
Done! Builds starting on GitHub...
```

#### [6] View All Versions
Shows all version tags (local and on GitHub).

**When to use**: To see what versions exist

### CHECK THINGS

#### [7] Check if Mobile and Web Match
Compares mobile and web apps to see if they're in sync.

**What it checks**:
- Version numbers match
- All screens exist in mobile app
- Configuration is correct

**When to use**: Before releasing, to ensure consistency

#### [8] Check if Everything is OK
Verifies all apps are properly configured.

**What it checks**:
- Web app exists and configured
- Mobile app exists and configured
- Server exists and configured
- Desktop app exists and configured

**When to use**: After setting up project, or troubleshooting

#### [9] View My Changes
Shows detailed changes you've made.

**What it does**:
- Lists changed files
- Optionally shows line-by-line changes

**When to use**: To review your work before saving

### ADVANCED (for developers)

#### [10] Create New Branch
Creates a separate workspace for your changes.

**What it does**:
1. Asks for branch name
2. Creates the branch
3. Switches to it

**When to use**: Starting a new feature or experiment

**Example**:
```
Select: 10
Branch name: feature/new-playlist-view
Done! You're now on the new branch.
```

#### [11] Switch Branch
Changes to a different branch.

**What it does**:
1. Shows available branches
2. Switches to the one you choose

**When to use**: Moving between different features or versions

#### [12] View Branches
Lists all branches (local and on GitHub).

**When to use**: To see what branches exist

#### [13] View Commit History
Shows recent changes made to the project.

**What it does**:
- Lists last 10 changes
- Shows who made them
- Shows when they were made

**When to use**: To see project history

#### [14] Push Tag Only
Uploads a version tag you already created.

**What it does**:
1. Shows your version tags
2. Uploads the one you choose
3. Triggers automatic builds

**When to use**: If you created a tag but didn't upload it yet

#### [15] Delete Version Tag
Removes a version tag (locally and from GitHub).

**What it does**:
1. Shows your version tags
2. Deletes the one you choose
3. Removes it from GitHub too

**When to use**: If you made a mistake creating a version

**Warning**: This is permanent!

### HELP

#### [16] Check Requirements
Verifies all required software is installed.

**What it checks**:
- Git installed
- Node.js installed
- npm installed
- Project is a Git repository

**When to use**: First time setup, or troubleshooting

#### [17] View Remote Info
Shows GitHub repository information.

**What it shows**:
- GitHub repository URL
- Remote branches
- Connection status

**When to use**: Verifying GitHub connection

#### [18] Clean Cache
Removes files from Git cache and re-adds them.

**What it does**:
1. Clears Git's file cache
2. Re-adds all files
3. Respects .gitignore rules

**When to use**: After updating .gitignore file

**Note**: You'll need to save your work after this (option 1)

## Common Workflows

### Daily Work Routine

**Morning - Get Latest**
```
1. Run: scripts\github-manager.bat
2. Select: [2] Get Latest Changes
3. Start working on your changes
```

**During Day - Check Progress**
```
Select: [3] What Changed?
Review your changes
```

**End of Day - Save Work**
```
Select: [1] Save My Work
Describe: "Added new playlist sorting feature"
Done! Work saved and uploaded.
```

### Creating a New Feature

**Step 1: Create Branch**
```
Select: [10] Create New Branch
Name: feature/playlist-sorting
```

**Step 2: Make Changes**
- Edit files in your IDE
- Test your changes

**Step 3: Save Progress**
```
Select: [1] Save My Work
Describe: "Work in progress on playlist sorting"
```

**Step 4: When Feature is Done**
```
Select: [11] Switch Branch
Choose: main

Select: [1] Save My Work (if needed)
```

Then merge your feature branch using GitHub's web interface (Pull Request).

### Releasing a New Version

**Step 1: Make Sure Everything is Saved**
```
Select: [3] What Changed?
If changes exist:
  Select: [1] Save My Work
```

**Step 2: Check Everything**
```
Select: [7] Check if Mobile and Web Match
Select: [8] Check if Everything is OK
```

**Step 3: (Optional) Build Locally First**
```
Select: [4] Build Everything
Wait 10-30 minutes
Test the builds
```

**Step 4: Create Release**
```
Select: [5] Create New Version
Version: v2.0.1
What's new: Bug fixes and performance improvements
Confirm: Y
```

**Step 5: Monitor Build**
- Go to: https://github.com/yourusername/playlist-lab/actions
- Watch the build progress (30-45 minutes)
- Download from Releases page when done

### Fixing a Bug Quickly

**Step 1: Check Current Status**
```
Select: [3] What Changed?
If you have unsaved work, save it first
```

**Step 2: Get Latest**
```
Select: [2] Get Latest Changes
```

**Step 3: Fix the Bug**
- Edit the files
- Test the fix

**Step 4: Save and Upload**
```
Select: [1] Save My Work
Describe: "Fixed login page crash"
```

**Step 5: (If Urgent) Create Hotfix Release**
```
Select: [5] Create New Version
Version: v2.0.2
What's new: Critical bug fix for login
Confirm: Y
```

## Safety Features

### Automatic Checks
- Verifies Git, Node.js, and npm are installed
- Checks project is set up correctly
- Warns before dangerous operations

### Confirmation Prompts
Important operations ask for confirmation:
- Creating a new version
- Uploading versions (triggers builds)
- Deleting version tags

### Color Warnings
- Red: Errors and problems
- Yellow: Important warnings
- Green: Success
- Blue: Information

## Tips and Best Practices

### Describing Your Work
When saving work, use clear descriptions:

✅ Good:
- "Fixed login page crash"
- "Added playlist sorting feature"
- "Updated mobile app icons"

❌ Bad:
- "changes"
- "stuff"
- "update"

### Version Numbers
Use semantic versioning: `v{major}.{minor}.{patch}`

- `v2.0.0` - Major release (big changes)
- `v2.1.0` - Minor release (new features)
- `v2.1.1` - Patch release (bug fixes)

Examples:
- `v2.0.1` - Bug fix release
- `v2.1.0` - Added new feature
- `v3.0.0` - Major redesign

### Branch Names
Use descriptive names with prefixes:

- `feature/playlist-sorting` - New feature
- `bugfix/login-crash` - Bug fix
- `hotfix/critical-security` - Urgent fix

### When to Build Everything
Use option [4] "Build Everything" when:
- Testing before a release
- Verifying all platforms work
- Creating builds for local testing

Use option [5] "Create New Version" when:
- Ready to release publicly
- Want automatic builds on GitHub
- Creating an official release

## Troubleshooting

### "Git not found"
**Problem**: Git is not installed

**Solution**: 
1. Download from https://git-scm.com/download/win
2. Install Git
3. Restart Simple Manager
4. Use option [16] to verify

### "Node.js not found"
**Problem**: Node.js is not installed

**Solution**:
1. Download from https://nodejs.org/
2. Install Node.js (includes npm)
3. Restart Simple Manager
4. Use option [16] to verify

### "Not a Git repository"
**Problem**: Project is not set up with Git

**Solution**:
1. Close Simple Manager
2. Open Command Prompt
3. Run: `cd K:\Projects\Playlist Lab`
4. Run: `git init`
5. Run Simple Manager again

### "Failed to upload"
**Problem**: Can't connect to GitHub

**Solutions**:
1. Check internet connection
2. Verify GitHub is accessible
3. Check if you have permission to push
4. Try option [17] to view remote info

### "Build failed"
**Problem**: Build process encountered errors

**Solutions**:
1. Check all files are saved (option [3])
2. Verify all apps are OK (option [8])
3. Check build logs for specific errors
4. Ensure all dependencies are installed

### "Versions don't match"
**Problem**: Mobile and web apps have different versions

**Solution**:
1. Update version in `apps/web/package.json`
2. Update version in `apps/mobile/package.json`
3. Make them match
4. Save your work (option [1])
5. Check again (option [7])

## Advanced Tips

### Building Specific Platforms
If you only want to build for one platform, use the build scripts directly:

```cmd
# Windows only
scripts\installers\windows\build-windows.bat

# macOS only (on Mac)
scripts/installers/macos/build-macos.sh

# Linux only (on Linux)
scripts/installers/linux/build-linux.sh
```

### Viewing Build Progress
After creating a version (option [5]), monitor builds:

1. Go to: https://github.com/yourusername/playlist-lab/actions
2. Click on the latest workflow run
3. Watch each job complete
4. Download artifacts when done

### Testing Before Release
Best practice workflow:

1. Build locally first (option [4])
2. Test all builds thoroughly
3. Fix any issues
4. Save your work (option [1])
5. Create release (option [5])

## What Happens When You Create a Version

When you use option [5] "Create New Version":

**Immediately**:
1. Creates version tag locally
2. Uploads tag to GitHub
3. GitHub Actions starts

**On GitHub (automatic)**:
1. Checks out code
2. Installs dependencies
3. Builds Windows installer (~10 min)
4. Builds macOS installer (~10 min)
5. Builds Linux packages (~10 min)
6. Builds desktop apps (~5 min)
7. Builds mobile apps (~10 min)
8. Publishes Docker images (~5 min)
9. Creates GitHub Release
10. Uploads all files to Release

**Total Time**: 30-45 minutes

**Result**: 
- Downloadable installers for all platforms
- Published mobile apps (if configured)
- Docker images available
- GitHub Release with changelog

## Related Documentation

- [GitHub Actions Setup](GITHUB_ACTIONS_SETUP.md) - How automatic builds work
- [Developer Guide](DEVELOPER_GUIDE.md) - Development workflow
- [Deployment Guide](DEPLOYMENT_ANYWHERE.md) - Deployment instructions
- [Web vs Mobile Comparison](WEB_MOBILE_COMPARISON.md) - App differences

## Quick Reference Card

### Most Common Operations

| What You Want | Option | Time |
|---------------|--------|------|
| Save my work | [1] | 10 sec |
| Get latest changes | [2] | 10 sec |
| See what changed | [3] | 5 sec |
| Build everything locally | [4] | 10-30 min |
| Release new version | [5] | 30-45 min |
| Check mobile/web match | [7] | 5 sec |
| Check everything OK | [8] | 5 sec |

### When to Use Each Option

**Every Day**:
- [2] Get Latest Changes (morning)
- [3] What Changed? (before saving)
- [1] Save My Work (end of day)

**Before Releasing**:
- [7] Check if Mobile and Web Match
- [8] Check if Everything is OK
- [4] Build Everything (optional, for testing)
- [5] Create New Version

**When Troubleshooting**:
- [16] Check Requirements
- [17] View Remote Info
- [8] Check if Everything is OK

**For Developers**:
- [10] Create New Branch (new feature)
- [11] Switch Branch (change features)
- [13] View Commit History (see changes)

## Support

Need help?

1. **Check Requirements**: Use option [16]
2. **Read This Guide**: You're here!
3. **Check GitHub Issues**: https://github.com/yourusername/playlist-lab/issues
4. **Git Documentation**: https://git-scm.com/doc

## Keyboard Tips

- Type the number and press Enter
- Type `0` to exit
- Press Ctrl+C to cancel anytime

---

**Remember**: The Simple Manager is here to make your life easier. You don't need to know Git commands - just choose what you want to do from the menu!

**Happy coding!** 🚀
