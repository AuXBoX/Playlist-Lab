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
import { youtubeTargetAdapter } from './youtube-target';
import { appleTargetAdapter } from './apple-target';
import { amazonTargetAdapter } from './amazon-target';
import { tidalTargetAdapter } from './tidal-target';
import { qobuzTargetAdapter } from './qobuz-target';
import { listenbrainzTargetAdapter } from './listenbrainz-target';
import { youtubePlainTargetAdapter } from './youtube-plain-target';

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
adapterRegistry.registerTarget(youtubeTargetAdapter);
adapterRegistry.registerTarget(youtubePlainTargetAdapter);
adapterRegistry.registerTarget(appleTargetAdapter);
adapterRegistry.registerTarget(amazonTargetAdapter);
adapterRegistry.registerTarget(tidalTargetAdapter);
adapterRegistry.registerTarget(qobuzTargetAdapter);
adapterRegistry.registerTarget(listenbrainzTargetAdapter);

export { adapterRegistry };
