/**
 * Worlding Design System
 * 
 * Design Philosophy: Premium, Elegant, Glassmorphic
 * - Dark mode by default - photos are the heroes
 * - Warm coral accent for premium feel
 * - Glassmorphic UI elements with subtle transparency
 */

export const Colors = {
  // Core Backgrounds
  background: '#050505',      // Deep charcoal (not pure black)
  surface: '#1A1A1A',         // Cards, headers
  surfaceElevated: '#252525', // Elevated cards, modals
  
  // Accent Colors - Coral (Premium/Warm)
  accent: '#FF573D',          // Coral - primary action
  accentLight: '#FF7A66',     // Lighter coral for hover states
  accentDark: '#E64A32',      // Darker coral for pressed states
  
  // Secondary Accents
  success: '#10B981',         // Green for confirmations
  warning: '#F59E0B',         // Orange for warnings
  error: '#EF4444',           // Red for errors
  
  // Text Colors
  textPrimary: '#FFFFFF',
  textSecondary: '#A3A3A3',
  textMuted: '#666666',
  
  // Borders & Dividers
  border: '#2A2A2A',
  borderLight: '#3A3A3A',
  
  // Overlay Colors
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  
  // Glassmorphism - Premium Feel
  glass: 'rgba(255, 255, 255, 0.08)',
  glassLight: 'rgba(255, 255, 255, 0.12)',
  glassBorder: 'rgba(255, 255, 255, 0.15)',
  glassHighlight: 'rgba(255, 255, 255, 0.05)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const Typography = {
  // Font Families
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  
  // Font Sizes
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
    xxxl: 40,
    hero: 48,
  },
  
  // Line Heights
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#FF573D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  glowSubtle: {
    shadowColor: '#FF573D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
};

// Animation durations (in ms)
export const Animation = {
  fast: 150,
  normal: 300,
  slow: 500,
  verySlow: 800,
};

// Layout constants
export const Layout = {
  screenPadding: 20,
  cardPadding: 20,
  headerHeight: 60,
  tabBarHeight: 85,
  avatarSizeSmall: 28,
  avatarSizeMedium: 44,
  avatarSizeLarge: 72,
  photoGridColumns: 3,
  photoGridGap: 3,
};

export default {
  Colors,
  Spacing,
  Radius,
  Typography,
  Shadows,
  Animation,
  Layout,
};
