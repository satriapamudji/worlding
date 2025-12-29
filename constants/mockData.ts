/**
 * Mock Data for Worlding Demo
 *
 * This provides sample data for testing the UI before backend integration.
 * Uses Unsplash for high-quality sample images.
 */

export interface User {
  id: string;
  name: string;
  avatar?: string;
}

export type MediaType = 'image' | 'video';

export interface Photo {
  id: string;
  uri: string;
  thumbnailUri?: string;  // For video thumbnails
  type: MediaType;        // 'image' or 'video'
  width: number;
  height: number;
  duration?: number;      // Video duration in seconds
  owner: User;
  timestamp: Date;
}

/**
 * World States:
 * - active: Event ongoing, members can add photos ("Live")
 * - building: Members are still adding their photos ("Collecting")
 * - archived: Everyone contributed, World is a complete memory ("Complete")
 */
export type WorldState = 'active' | 'building' | 'archived';

/**
 * Member sync status within a World
 */
export interface WorldMember extends User {
  syncStatus: 'pending' | 'syncing' | 'synced';
  photoCount: number;
  lastSyncedAt?: Date;
}

export interface World {
  id: string;
  title: string;
  coverUri: string;
  dateRange: string;
  startDate: Date;
  endDate: Date;
  photoCount: number;
  members: WorldMember[];
  photos: Photo[];
  // New fields for World lifecycle
  state: WorldState;
  createdBy: User;
  createdAt: Date;
  archivedAt?: Date;
}

// Sample Users
export const MOCK_USERS: User[] = [
  { 
    id: 'user-1', 
    name: 'Alex Chen', 
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' 
  },
  { 
    id: 'user-2', 
    name: 'Sarah Kim', 
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' 
  },
  { 
    id: 'user-3', 
    name: 'Marcus Johnson', 
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop' 
  },
  { 
    id: 'user-4', 
    name: 'Emma Williams', 
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop' 
  },
  { 
    id: 'user-5', 
    name: 'David Park', 
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop' 
  },
];

export const CURRENT_USER = MOCK_USERS[0];

// Sample Photos for different contexts
interface MediaItem {
  uri: string;
  w: number;
  h: number;
  type: MediaType;
  thumbnailUri?: string;
  duration?: number;
}

const createPhotos = (worldId: string, users: User[]): Photo[] => {
  const photoSets: Record<string, MediaItem[]> = {
    'world-1': [
      { uri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600', w: 4, h: 3, type: 'image' },
      { uri: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600', w: 3, h: 4, type: 'image' },
      // Sample video - short clip for testing
      { 
        uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnailUri: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=600',
        w: 16, 
        h: 9, 
        type: 'video',
        duration: 15,
      },
      { uri: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600', w: 1, h: 1, type: 'image' },
      { uri: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=600', w: 3, h: 4, type: 'image' },
      { uri: 'https://images.unsplash.com/photo-1528164344705-47542687000d?w=600', w: 4, h: 3, type: 'image' },
      { uri: 'https://images.unsplash.com/photo-1504109586057-7a2ae83d1338?w=600', w: 3, h: 4, type: 'image' },
      { uri: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=600', w: 4, h: 3, type: 'image' },
    ],
    'world-2': [
      { uri: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=600', w: 4, h: 3, type: 'image' },
      { uri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600', w: 4, h: 3, type: 'image' },
      // Sample video for beach trip
      {
        uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        thumbnailUri: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=600',
        w: 16,
        h: 9,
        type: 'video',
        duration: 15,
      },
      { uri: 'https://images.unsplash.com/photo-1468413253725-0d5181091126?w=600', w: 4, h: 3, type: 'image' },
      { uri: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=600', w: 1, h: 1, type: 'image' },
      { uri: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=600', w: 4, h: 3, type: 'image' },
    ],
    'default': [
      { uri: 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=600', w: 4, h: 3, type: 'image' },
      { uri: 'https://images.unsplash.com/photo-1682687220208-22d7a2543e88?w=600', w: 3, h: 4, type: 'image' },
      { uri: 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=600', w: 4, h: 3, type: 'image' },
      { uri: 'https://images.unsplash.com/photo-1682695796954-bad0d0f59ff1?w=600', w: 1, h: 1, type: 'image' },
    ],
  };

  const set = photoSets[worldId] || photoSets['default'];
  
  return set.map((media, index) => ({
    id: `${worldId}-photo-${index}`,
    uri: media.uri,
    thumbnailUri: media.thumbnailUri,
    type: media.type,
    width: media.w * 100,
    height: media.h * 100,
    duration: media.duration,
    owner: users[index % users.length],
    timestamp: new Date(Date.now() - index * 3600000),
  }));
};

// Helper to create WorldMember from User
const toWorldMember = (
  user: User,
  syncStatus: 'pending' | 'syncing' | 'synced',
  photoCount: number
): WorldMember => ({
  ...user,
  syncStatus,
  photoCount,
  lastSyncedAt: syncStatus === 'synced' ? new Date() : undefined,
});

// Sample Worlds
export const MOCK_WORLDS: World[] = [
  {
    id: 'world-1',
    title: 'Tokyo 2024',
    coverUri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800',
    dateRange: 'Dec 15 - Dec 22',
    startDate: new Date('2024-12-15'),
    endDate: new Date('2024-12-22'),
    photoCount: 156,
    members: [
      toWorldMember(MOCK_USERS[0], 'synced', 52),
      toWorldMember(MOCK_USERS[1], 'synced', 67),
      toWorldMember(MOCK_USERS[2], 'synced', 37),
    ],
    photos: [],
    // Archived - complete memory
    state: 'archived',
    createdBy: MOCK_USERS[0],
    createdAt: new Date('2024-12-15'),
    archivedAt: new Date('2024-12-24'),
  },
  {
    id: 'world-2',
    title: "Sarah's Birthday Beach Trip",
    coverUri: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
    dateRange: 'Nov 28 - Nov 30',
    startDate: new Date('2024-11-28'),
    endDate: new Date('2024-11-30'),
    photoCount: 89,
    members: [
      toWorldMember(MOCK_USERS[0], 'synced', 23),
      toWorldMember(MOCK_USERS[1], 'syncing', 12),
      toWorldMember(MOCK_USERS[3], 'synced', 34),
      toWorldMember(MOCK_USERS[4], 'pending', 0),
    ],
    photos: [],
    // Still building - David hasn't added photos yet
    state: 'building',
    createdBy: MOCK_USERS[1],
    createdAt: new Date('2024-11-28'),
  },
];

// Populate photos
MOCK_WORLDS.forEach(world => {
  world.photos = createPhotos(world.id, world.members);
});

// Function to get a world by ID
export function getWorldById(id: string): World | undefined {
  return MOCK_WORLDS.find(world => world.id === id);
}

// Generate photos for "Magic Sync" simulation
export function generateSyncPhotos(count: number = 34): Photo[] {
  const photos: Photo[] = [];
  const unsplashIds = [
    'photo-1682687220742-aba13b6e50ba',
    'photo-1682687220208-22d7a2543e88',
    'photo-1682687220063-4742bd7fd538',
    'photo-1682695796954-bad0d0f59ff1',
    'photo-1682686581854-5e71f58e7e3f',
    'photo-1682695794947-17061dc284dd',
    'photo-1682686580849-3e8f2c64dca4',
    'photo-1682686581551-867e0b208bd1',
    'photo-1587502537745-84b86da1204f',
    'photo-1533050487297-09b450131914',
  ];

  for (let i = 0; i < count; i++) {
    const id = unsplashIds[i % unsplashIds.length];
    photos.push({
      id: `sync-photo-${i}`,
      uri: `https://images.unsplash.com/${id}?w=400`,
      type: 'image',
      width: Math.random() > 0.5 ? 400 : 300,
      height: Math.random() > 0.5 ? 300 : 400,
      owner: CURRENT_USER,
      timestamp: new Date(Date.now() - i * 3600000),
    });
  }

  return photos;
}
