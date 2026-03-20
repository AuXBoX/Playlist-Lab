/**
 * Tests for Billboard chart scraping using GitHub data source
 */

import { scrapeBillboardChart } from '../../src/services/browser-scrapers';

describe('Billboard Chart Scraper', () => {
  // Increase timeout for network requests
  jest.setTimeout(15000);

  it('should fetch the most recent Billboard Hot 100 chart', async () => {
    const url = 'https://www.billboard.com/charts/hot-100/';
    
    const result = await scrapeBillboardChart(url);
    
    expect(result).toBeDefined();
    expect(result.source).toBe('billboard');
    expect(result.name).toContain('Billboard Hot 100');
    expect(result.tracks).toBeDefined();
    expect(result.tracks.length).toBeGreaterThan(0);
    expect(result.tracks.length).toBeLessThanOrEqual(100);
    
    // Check first track has required fields
    const firstTrack = result.tracks[0];
    expect(firstTrack.title).toBeDefined();
    expect(firstTrack.artist).toBeDefined();
    expect(typeof firstTrack.title).toBe('string');
    expect(typeof firstTrack.artist).toBe('string');
  });

  it('should fetch a specific date Billboard Hot 100 chart', async () => {
    // Use a known date that should exist
    const url = 'https://www.billboard.com/charts/hot-100/2024-01-06/';
    
    const result = await scrapeBillboardChart(url);
    
    expect(result).toBeDefined();
    expect(result.source).toBe('billboard');
    expect(result.name).toContain('2024-01-06');
    expect(result.tracks).toBeDefined();
    expect(result.tracks.length).toBeGreaterThan(0);
  });

  it('should throw error for unsupported chart types', async () => {
    const url = 'https://www.billboard.com/charts/billboard-200/';
    
    await expect(scrapeBillboardChart(url)).rejects.toThrow('not currently supported');
  });

  it('should throw error for invalid date', async () => {
    const url = 'https://www.billboard.com/charts/hot-100/1900-01-01/';
    
    await expect(scrapeBillboardChart(url)).rejects.toThrow();
  });
});
