# Grok API Setup Guide

This guide explains how to get a free Grok API key for AI-powered playlist generation.

## What is Grok?

Grok is xAI's conversational AI assistant. The free tier provides access to the Grok API, which Playlist Lab uses to intelligently generate playlists based on natural language descriptions.

## Getting Your Free API Key

1. **Visit the xAI Console**
   - Go to [console.x.ai](https://console.x.ai)

2. **Sign In**
   - Sign in with your X (Twitter) account
   - If you don't have an X account, you'll need to create one first

3. **Create an API Key**
   - Once logged in, navigate to the API Keys section
   - Click "Create API Key"
   - Give it a name (e.g., "Playlist Lab")
   - Copy the API key immediately - you won't be able to see it again!

4. **Use in Playlist Lab**
   - Go to the Import page in Playlist Lab
   - Select "AI Generated" as the source
   - Paste your API key in the "Grok API Key" field
   - Enter your playlist description
   - Click "Generate Playlist"

## Free Tier Limits

The free tier includes:
- Access to the Grok API
- Rate limits apply (check xAI documentation for current limits)
- No credit card required

## Security Notes

- **Never share your API key** - treat it like a password
- The API key is only sent to your Playlist Lab server, never stored
- Each request includes your API key to authenticate with Grok
- If you suspect your key has been compromised, revoke it in the xAI console and create a new one

## How It Works

When you use AI generation:

1. You provide a description like "upbeat 80s rock songs"
2. Playlist Lab sends your description to Grok
3. Grok analyzes your request and generates search queries
4. Playlist Lab searches your Plex library using those queries
5. Matching tracks are compiled into a playlist
6. Grok also generates a creative playlist name

## Troubleshooting

### "Invalid Grok API key" Error
- Double-check you copied the entire API key
- Make sure there are no extra spaces
- Verify the key hasn't been revoked in the xAI console

### "No library selected" Error
- Go to Settings
- Select your Plex server
- Select a music library
- Try AI generation again

### No Tracks Found
- Try being more specific in your description
- Use artist names, genres, or moods
- Make sure you have music in your Plex library that matches the description

## Example Prompts

Good prompts are specific and descriptive:

- ✅ "Upbeat 80s rock songs with guitar solos"
- ✅ "Relaxing jazz piano for studying"
- ✅ "High-energy workout music with heavy bass"
- ✅ "Sad indie folk songs about heartbreak"
- ✅ "Classic hip-hop from the 90s"

Avoid vague prompts:
- ❌ "Good music"
- ❌ "Songs"
- ❌ "Playlist"

## Privacy

- Your API key is sent directly from your browser to your Playlist Lab server
- Your server uses it to make requests to Grok's API
- The key is not stored anywhere
- Your playlist descriptions are sent to Grok for processing
- No personal information is shared with xAI beyond what's in your prompt

## Support

For issues with:
- **Grok API**: Contact xAI support at [x.ai](https://x.ai)
- **Playlist Lab**: Check the main documentation or open an issue on GitHub
