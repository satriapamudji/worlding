# Worlding

A React Native mobile app for creating shared photo collections called "Worlds" for trips, events, and special occasions.

## Overview

Worlding lets you create collaborative photo albums where everyone's memories sync together. Create a World for your next trip, invite friends, and watch as everyone's photos come together in one beautiful timeline.

## Features

- **Create Worlds** - Start a new World for any occasion with custom date ranges
- **Invite Friends** - Share invite links or QR codes to add collaborators
- **Photo Grid** - Browse all photos in a beautiful grid with date headers
- **Media Viewer** - Full-screen viewer with pinch-to-zoom and swipe navigation
- **Video Support** - Play videos with timeline scrubbing
- **Sync Status** - See who has synced their photos in real-time
- **Relive Moments** - Archive completed Worlds and revisit memories

## Tech Stack

- **Framework**: React Native 0.81 with Expo SDK 54 (new architecture enabled)
- **Routing**: Expo Router (file-based, typed routes)
- **Backend**: Supabase (auth, database, storage)
- **State**: React Context
- **Animations**: React Native Reanimated
- **Lists**: Shopify FlashList
- **Gestures**: React Native Gesture Handler

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator / Android Emulator / Physical device with Expo Go

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/satriapamudji/worlding.git
   cd worlding
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables
   ```bash
   cp .env.example .env
   ```
   
   Add your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   ```

4. Start the development server
   ```bash
   npm start
   ```

5. Run on your preferred platform
   ```bash
   npm run ios      # iOS Simulator
   npm run android  # Android Emulator
   npm run web      # Web browser
   ```

## Project Structure

```
app/                    # Expo Router file-based routes
  (tabs)/               # Tab navigation (authenticated)
    index.tsx           # Home/Worlds list
    create.tsx          # Create new World
    profile.tsx         # User profile
  settings/             # Settings screens
  world/                # World detail screens
    [id].tsx            # Dynamic World route
    media.tsx           # Full-screen media viewer
  auth.tsx              # Authentication screen
  onboarding.tsx        # Onboarding flow

components/             # Reusable UI components
  MediaViewer.tsx       # Zoomable image/video viewer
  WorldCard.tsx         # World preview card
  GlassCard.tsx         # Glassmorphic card component
  Button.tsx            # Animated button component

constants/
  theme.ts              # Design system tokens
  Colors.ts             # Color palette

hooks/
  useAuth.tsx           # Authentication context

lib/
  supabase.ts           # Supabase client
  media-utils.ts        # Media helper functions
  date-utils.ts         # Date formatting utilities
```

## Design System

Worlding uses a custom glassmorphic dark theme:

- **Background**: `#050505`
- **Accent**: `#FF573D` (coral)
- **Glass effects**: Translucent cards with blur
- **Typography**: System fonts with consistent scale
- **Spacing**: 4px base unit (xs/sm/md/lg/xl/xxl)

## Scripts

```bash
npm start              # Start Expo dev server
npm run ios            # Run on iOS
npm run android        # Run on Android
npm run web            # Run on web
npm run typecheck      # Run TypeScript compiler
```

## License

Private - All rights reserved
