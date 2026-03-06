/**
 * Charts API - Dynamic popular playlists by country using search
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Country name mapping
const countryNames: Record<string, string> = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'ES': 'Spain',
  'IT': 'Italy',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'JP': 'Japan',
  'KR': 'South Korea',
  'IN': 'India',
  'NL': 'Netherlands',
  'SE': 'Sweden',
  'NO': 'Norway',
  'PL': 'Poland',
  'AR': 'Argentina',
  'CL': 'Chile',
  'NZ': 'New Zealand',
};

/**
 * Get popular playlists for a source and country by searching
 * GET /api/charts/:source/:country
 */
router.get('/:source/:country', requireAuth, async (req, res) => {
  const { source, country } = req.params;
  
  try {
    const countryName = countryNames[country] || country;
    const searchQuery = `top songs ${countryName}`;
    
    // Import the scraper functions
    const scrapers = await import('../services/scrapers');
    
    let playlists: any[] = [];
    
    // Call the appropriate search function based on source
    switch (source) {
      case 'deezer':
        playlists = await scrapers.getDeezerPopularPlaylists(country);
        break;
      case 'youtube':
        playlists = await scrapers.searchYouTubeMusicPlaylists(searchQuery);
        break;
      case 'apple':
        playlists = await scrapers.searchAppleMusicPlaylists(country);
        break;
      default:
        return res.status(400).json({ error: `Unsupported source: ${source}` });
    }
    
    return res.json({ playlists });
  } catch (error) {
    console.error(`[Charts] Error fetching ${source} charts for ${country}:`, error);
    return res.status(500).json({ error: 'Failed to fetch charts' });
  }
});

export default router;
