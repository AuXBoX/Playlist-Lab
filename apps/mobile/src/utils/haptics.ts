import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic feedback utilities for native-feeling interactions
 */

export const hapticFeedback = {
  /**
   * Light impact feedback for button taps
   */
  light: async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  },

  /**
   * Medium impact feedback for selections
   */
  medium: async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  },

  /**
   * Heavy impact feedback for important actions
   */
  heavy: async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  },

  /**
   * Success notification feedback
   */
  success: async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },

  /**
   * Warning notification feedback
   */
  warning: async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  },

  /**
   * Error notification feedback
   */
  error: async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  },

  /**
   * Selection changed feedback (for pickers, sliders)
   */
  selection: async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Haptics.selectionAsync();
    }
  },
};

export default hapticFeedback;
