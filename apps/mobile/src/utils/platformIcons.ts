import { Platform } from 'react-native';

/**
 * Platform-specific icon mappings
 * iOS uses SF Symbols style, Android uses Material Design
 */

export const platformIcons = {
  // Navigation icons
  home: Platform.OS === 'ios' ? 'home-outline' : 'view-dashboard',
  import: Platform.OS === 'ios' ? 'download-outline' : 'download',
  generate: Platform.OS === 'ios' ? 'sparkles-outline' : 'auto-fix',
  playlists: Platform.OS === 'ios' ? 'musical-notes-outline' : 'playlist-music',
  settings: Platform.OS === 'ios' ? 'settings-outline' : 'cog',
  
  // Action icons
  add: Platform.OS === 'ios' ? 'add-circle-outline' : 'plus-circle',
  delete: Platform.OS === 'ios' ? 'trash-outline' : 'delete',
  edit: Platform.OS === 'ios' ? 'create-outline' : 'pencil',
  search: Platform.OS === 'ios' ? 'search-outline' : 'magnify',
  refresh: Platform.OS === 'ios' ? 'refresh-outline' : 'refresh',
  
  // Status icons
  success: Platform.OS === 'ios' ? 'checkmark-circle' : 'check-circle',
  error: Platform.OS === 'ios' ? 'close-circle' : 'alert-circle',
  warning: Platform.OS === 'ios' ? 'warning' : 'alert',
  info: Platform.OS === 'ios' ? 'information-circle' : 'information',
  
  // Media icons
  play: Platform.OS === 'ios' ? 'play-circle' : 'play-circle-outline',
  pause: Platform.OS === 'ios' ? 'pause-circle' : 'pause-circle-outline',
  skip: Platform.OS === 'ios' ? 'play-skip-forward' : 'skip-next',
  
  // Misc icons
  menu: Platform.OS === 'ios' ? 'menu-outline' : 'menu',
  close: Platform.OS === 'ios' ? 'close' : 'close',
  back: Platform.OS === 'ios' ? 'chevron-back' : 'arrow-left',
  forward: Platform.OS === 'ios' ? 'chevron-forward' : 'arrow-right',
  more: Platform.OS === 'ios' ? 'ellipsis-horizontal' : 'dots-vertical',
};

/**
 * Get platform-appropriate icon name
 */
export function getPlatformIcon(iconKey: keyof typeof platformIcons): string {
  return platformIcons[iconKey];
}

export default platformIcons;
