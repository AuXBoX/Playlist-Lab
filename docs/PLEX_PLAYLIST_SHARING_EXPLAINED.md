# Plex Playlist Sharing - How It Actually Works

## The Reality

After investigating the Plex API and reviewing community scripts, I discovered that **Plex does not have a native "share playlist" feature in its API**. What appears as "sharing" in Plex and Plexamp is actually **copying playlists** between user accounts.

## How Plex/Plexamp "Sharing" Works

When you "share" a playlist in Plex or Plexamp:

1. The app gets your playlist and its tracks
2. It retrieves the target user's access token from plex.tv
3. It creates a NEW playlist in the target user's account
4. It adds all the tracks to that new playlist

This means:
- The "shared" playlist is an independent copy
- Changes to your playlist don't affect their copy
- There's no link between the two playlists
- Plex doesn't track which playlists have been "shared"

## What We Can Do With Access Tokens

While Plex doesn't track sharing, we CAN use the access tokens to:

1. **Share (copy) playlists to friends** - Create copies in their accounts
2. **Browse friends' playlists** - View what playlists they have
3. **See playlist details** - Track count, duration, etc.

This is possible because when you add a Plex friend and grant them library access, you can retrieve their access token from plex.tv's `/api/servers/{server_id}/shared_servers` endpoint.

## Implementation in Playlist Lab

### Features Implemented

1. **Share Playlists Tab**
   - Select one or more friends using checkboxes
   - Share a playlist with multiple friends at once
   - Creates independent copies in each friend's account

2. **Browse Friends' Playlists Tab**
   - View list of all your Plex friends
   - Click a friend to see their playlists
   - View playlist details (name, track count, duration)

### How It Works

#### Sharing Playlists

1. User selects a playlist and friends to share with
2. For each friend:
   - Get their access token from plex.tv
   - Create a new Plex client with their token
   - Delete any existing playlist with the same name (optional)
   - Create a new playlist in their account
   - Add all tracks to the new playlist

#### Browsing Friends' Playlists

1. User clicks on a friend in the list
2. App retrieves the friend's access token from plex.tv
3. Creates a Plex client with the friend's token
4. Fetches their playlists using the standard `/playlists` endpoint
5. Displays the playlists with details

### Code Location

- **Backend**: 
  - `apps/server/src/services/plex.ts` - `sharePlaylist()` and `getFriendPlaylists()` methods
  - `apps/server/src/routes/plex-sharing.ts` - API routes
- **Frontend**: `apps/web/src/pages/SharePlaylistsPage.tsx`
- **API Routes**: 
  - `/api/playlists/:id/share-to-friend` - Share a playlist
  - `/api/plex/friends` - Get list of friends
  - `/api/plex/friends/:username/playlists` - Get friend's playlists

### Key Methods

```typescript
// Get friends from plex.tv
async getFriends(): Promise<PlexFriend[]>

// Share (copy) playlist to a friend's account
async sharePlaylist(playlistId: string, targetUsername: string): Promise<void>

// Get playlists from a friend's account
async getFriendPlaylists(friendUsername: string): Promise<FriendPlaylist[]>
```

## API Limitations

### No Sharing Metadata

Playlists in Plex do NOT have:
- A `shared` field indicating they've been shared
- A list of users they've been shared with
- Any reference to the original playlist if it's a copy

### No Tracking

The Plex API provides no way to:
- List which playlists you've shared
- See who has copies of your playlists
- Track sharing history
- Know if a friend's playlist is a copy of yours

## User Experience

### Sharing Playlists

1. User sees a list of their Plex friends
2. They can select multiple friends using checkboxes
3. They click "Share with X friends"
4. The app creates copies in each friend's account
5. Success message shows how many friends received the playlist

### Browsing Friends' Playlists

1. User switches to "Browse Friends' Playlists" tab
2. They see a list of their Plex friends on the left
3. They click a friend to view their playlists
4. Friend's playlists appear on the right with details
5. They can see what music their friends are organizing

## Limitations

- No way to "unshare" - the copy exists independently
- No way to sync updates - changes don't propagate
- No way to see who has copies of your playlists
- Can't track shares made outside Playlist Lab
- Can't tell if a friend's playlist is a copy of yours

## Privacy Considerations

- Friends can only see playlists if they have library access
- Access tokens are retrieved securely from plex.tv
- Tokens are not stored - fetched on-demand
- Only works with users who have granted library access

## References

- [Plexopedia: Create a Playlist](https://www.plexopedia.com/plex-media-server/api/playlists/create/) - States playlists "can't be shared with other users"
- [GitHub Gist: Sync Plex playlists](https://gist.github.com/ReenigneArcher/2b518233db5b3e05c8894503dce0715f) - Community script showing the copy approach
- Plex.tv API: `/api/servers/{server_id}/shared_servers` - Used to get user access tokens
- Plex.tv API: `/api/users` - Used to map user IDs to usernames
