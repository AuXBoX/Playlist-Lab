import { adapterRegistry } from './registry';

// Source adapters
import { plexSourceAdapter } from './plex-source';
import { spotifySourceAdapter } from './spotify-source';
import { deezerSourceAdapter } from './deezer-source';
import { youtubeSourceAdapter } from './youtube-source';
import { youtubePlainSourceAdapter } from './youtube-plain-source';
import { appleSourceAdapter } from './apple-source';
import { amazonSourceAdapter } from './amazon-source';
import { tidalSourceAdapter } from './tidal-source';
import { qobuzSourceAdapter } from './qobuz-source';
import { listenbrainzSourceAdapter } from './listenbrainz-source';

// Target adapters
import { plexTargetAdapter } from './plex-target';
import { spotifyTargetAdapter } from './spotify-target';
import { deezerTargetAdapter } from './deezer-target';
// import { youtubeTargetAdapter } from './youtube-target'; // Old scraper-based - unused
import { appleTargetAdapter } from './apple-target';
import { amazonTargetAdapter } from './amazon-target';
import { tidalTargetAdapter } from './tidal-target';
import { qobuzTargetAdapter } from './qobuz-target';
import { listenbrainzTargetAdapter } from './listenbrainz-target';
// import { youtubePlainTargetAdapter } from './youtube-plain-target'; // DEPRECATED: Replaced by OAuth adapter
// import { youtubeOAuthTargetAdapter } from './youtube-oauth-target'; // DEPRECATED: Quota limited
import { youtubeInnertubeTargetAdapter } from './youtube-innertube-target'; // No quota limits!

// Register sources
adapterRegistry.registerSource(plexSourceAdapter);
adapterRegistry.registerSource(spotifySourceAdapter);
adapterRegistry.registerSource(deezerSourceAdapter);
adapterRegistry.registerSource(youtubeSourceAdapter);
adapterRegistry.registerSource(youtubePlainSourceAdapter);
adapterRegistry.registerSource(appleSourceAdapter);
adapterRegistry.registerSource(amazonSourceAdapter);
adapterRegistry.registerSource(tidalSourceAdapter);
adapterRegistry.registerSource(qobuzSourceAdapter);
adapterRegistry.registerSource(listenbrainzSourceAdapter);

// Register targets
adapterRegistry.registerTarget(plexTargetAdapter);
adapterRegistry.registerTarget(spotifyTargetAdapter);
adapterRegistry.registerTarget(deezerTargetAdapter);
// adapterRegistry.registerTarget(youtubeTargetAdapter); // Old scraper-based
// adapterRegistry.registerTarget(youtubePlainTargetAdapter); // DEPRECATED: Replaced by OAuth adapter
// adapterRegistry.registerTarget(youtubeOAuthTargetAdapter); // DEPRECATED: Quota limited
adapterRegistry.registerTarget(youtubeInnertubeTargetAdapter); // No quota limits!
adapterRegistry.registerTarget(appleTargetAdapter);
adapterRegistry.registerTarget(amazonTargetAdapter);
adapterRegistry.registerTarget(tidalTargetAdapter);
adapterRegistry.registerTarget(qobuzTargetAdapter);
adapterRegistry.registerTarget(listenbrainzTargetAdapter);

export { adapterRegistry };
