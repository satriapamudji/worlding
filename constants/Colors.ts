/**
 * Worlding Colors - Legacy compatibility
 */

import { Colors as ThemeColors } from './theme';

export const Colors = {
  light: {
    text: '#000',
    background: '#fff',
    tint: ThemeColors.accent,
    tabIconDefault: '#ccc',
    tabIconSelected: ThemeColors.accent,
  },
  dark: {
    text: ThemeColors.textPrimary,
    background: ThemeColors.background,
    tint: ThemeColors.accent,
    tabIconDefault: ThemeColors.textMuted,
    tabIconSelected: ThemeColors.accent,
  },
};

export default Colors;
