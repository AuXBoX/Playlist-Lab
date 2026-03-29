/**
 * Last.fm API Service
 * 
 * Provides access to Last.fm data for discovering popular artists and tracks
 * No API key required for basic chart data
 */

import axios from 'axios';
import { logger } from '../utils/logger';

const LASTFM_API_BASE = 'https://ws.audioscrobbler.com/2.0/';
const LASTFM_API_KEY = 'b25b959554ed76058ac220b7b2e0a026'; // Public API key for read-only operations

export interface LastFmArtist {
  name: string;
  playcount: string;
  listeners: string;
  mbid?: string;
  url: string;
}

export interface LastFmTrack {
  name: string;
  artist: string;
  playcount: string;
  listeners: string;
  mbid?: string;
  url: string;
}

export class LastFmService {
  /**
   * Get top artists from a specific time period
   * Uses Last.fm's chart.getTopArtists endpoint
   */
  async getTopArtists(limit: number = 50): Promise<LastFmArtist[]> {
    try {
      const response = await axios.get(LASTFM_API_BASE, {
        params: {
          method: 'chart.gettopartists',
          api_key: LASTFM_API_KEY,
          format: 'json',
          limit: limit
        },
        timeout: 10000
      });

      const artists = response.data?.artists?.artist || [];
      logger.info('Fetched top artists from Last.fm', { count: artists.length });
      
      return artists.map((artist: any) => ({
        name: artist.name,
        playcount: artist.playcount,
        listeners: artist.listeners,
        mbid: artist.mbid,
        url: artist.url
      }));
    } catch (error: any) {
      logger.error('Failed to fetch top artists from Last.fm', { error: error.message });
      return [];
    }
  }

  /**
   * Get top tracks from a specific time period
   */
  async getTopTracks(limit: number = 50): Promise<LastFmTrack[]> {
    try {
      const response = await axios.get(LASTFM_API_BASE, {
        params: {
          method: 'chart.gettoptracks',
          api_key: LASTFM_API_KEY,
          format: 'json',
          limit: limit
        },
        timeout: 10000
      });

      const tracks = response.data?.tracks?.track || [];
      logger.info('Fetched top tracks from Last.fm', { count: tracks.length });
      
      return tracks.map((track: any) => ({
        name: track.name,
        artist: track.artist?.name || '',
        playcount: track.playcount,
        listeners: track.listeners,
        mbid: track.mbid,
        url: track.url
      }));
    } catch (error: any) {
      logger.error('Failed to fetch top tracks from Last.fm', { error: error.message });
      return [];
    }
  }

  /**
   * Get top artists by tag (genre)
   * Useful for genre-specific mixes
   */
  async getTopArtistsByTag(tag: string, limit: number = 50): Promise<LastFmArtist[]> {
    try {
      const response = await axios.get(LASTFM_API_BASE, {
        params: {
          method: 'tag.gettopartists',
          tag: tag,
          api_key: LASTFM_API_KEY,
          format: 'json',
          limit: limit
        },
        timeout: 10000
      });

      const artists = response.data?.topartists?.artist || [];
      logger.info('Fetched top artists by tag from Last.fm', { tag, count: artists.length });
      
      return artists.map((artist: any) => ({
        name: artist.name,
        playcount: artist.playcount || '0',
        listeners: artist.listeners || '0',
        mbid: artist.mbid,
        url: artist.url
      }));
    } catch (error: any) {
      logger.error('Failed to fetch top artists by tag from Last.fm', { tag, error: error.message });
      return [];
    }
  }

  /**
   * Search for an artist by name
   * Returns best match
   */
  async searchArtist(artistName: string): Promise<LastFmArtist | null> {
    try {
      const response = await axios.get(LASTFM_API_BASE, {
        params: {
          method: 'artist.search',
          artist: artistName,
          api_key: LASTFM_API_KEY,
          format: 'json',
          limit: 1
        },
        timeout: 10000
      });

      const results = response.data?.results?.artistmatches?.artist || [];
      if (results.length === 0) return null;

      const artist = results[0];
      return {
        name: artist.name,
        playcount: '0',
        listeners: artist.listeners || '0',
        mbid: artist.mbid,
        url: artist.url
      };
    } catch (error: any) {
      logger.error('Failed to search artist on Last.fm', { artistName, error: error.message });
      return null;
    }
  }
}
