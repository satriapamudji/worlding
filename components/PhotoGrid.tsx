import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { Avatar } from './Avatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = Spacing.md;
const COLUMN_COUNT = Layout.photoGridColumns;
const GAP = Layout.photoGridGap;
const ITEM_WIDTH = (SCREEN_WIDTH - (GRID_PADDING * 2) - (GAP * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

export interface Photo {
  id: string;
  uri: string;
  width?: number;
  height?: number;
  owner?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface PhotoGridProps {
  photos: Photo[];
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onPhotoPress?: (photo: Photo) => void;
  showOwnerAvatar?: boolean;
}

/**
 * PhotoGrid - 3-column photo grid
 * 
 * UI/UX Standards:
 * - Consistent 3px gap between items
 * - 16px padding around grid
 * - 8px border radius on photos
 * - Smooth selection transitions
 */
export function PhotoGrid({
  photos,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onPhotoPress,
  showOwnerAvatar = true,
}: PhotoGridProps) {
  const toggleSelection = useCallback((photoId: string) => {
    if (!selectable || !onSelectionChange) return;

    // Haptic feedback on selection toggle
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const newSelection = selectedIds.includes(photoId)
      ? selectedIds.filter(id => id !== photoId)
      : [...selectedIds, photoId];

    onSelectionChange(newSelection);
  }, [selectable, selectedIds, onSelectionChange]);

  const renderPhoto = ({ item, index }: { item: Photo; index: number }) => {
    const isSelected = selectedIds.includes(item.id);
    
    return (
      <PhotoItem
        photo={item}
        index={index}
        isSelected={isSelected}
        selectable={selectable}
        showOwnerAvatar={showOwnerAvatar}
        onPress={() => {
          if (selectable) {
            toggleSelection(item.id);
          } else {
            onPhotoPress?.(item);
          }
        }}
      />
    );
  };

  return (
<FlatList
      data={photos}
      renderItem={renderPhoto}
      keyExtractor={(item) => item.id}
      numColumns={COLUMN_COUNT}
      style={{ flex: 1 }}
      contentContainerStyle={styles.gridContainer}
      columnWrapperStyle={styles.columnWrapper}
      showsVerticalScrollIndicator={false}
    />
  );
}

interface PhotoItemProps {
  photo: Photo;
  index: number;
  isSelected: boolean;
  selectable: boolean;
  showOwnerAvatar: boolean;
  onPress: () => void;
}

function PhotoItem({
  photo,
  index,
  isSelected,
  selectable,
  showOwnerAvatar,
  onPress,
}: PhotoItemProps) {
  const [loaded, setLoaded] = useState(false);
  const scale = useSharedValue(1);

  // Square aspect ratio for clean grid
  const itemHeight = ITEM_WIDTH;

  // Animate scale bounce on selection change (not opacity!)
  React.useEffect(() => {
    if (selectable && isSelected) {
      // Bounce animation when selected
      scale.value = withSequence(
        withTiming(0.92, { duration: 80 }),
        withSpring(1, { damping: 12, stiffness: 400 })
      );
    }
  }, [isSelected, selectable, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    // No opacity change - photos stay at full visibility
  }));

  return (
    <View 
      style={[styles.photoContainer, { height: itemHeight }]}
    >
      <Pressable onPress={onPress} style={styles.photoPressable}>
        <Animated.View style={[styles.photoWrapper, animatedStyle]}>
          <Image
            source={{ uri: photo.uri }}
            style={styles.photo}
            resizeMode="cover"
            onLoad={() => setLoaded(true)}
          />
          
          {/* Gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)']}
            style={styles.gradient}
          />
          
          {/* Owner avatar */}
          {showOwnerAvatar && photo.owner && loaded && (
            <View style={styles.avatarContainer}>
              <Avatar 
                uri={photo.owner.avatar}
                name={photo.owner.name}
                size="small"
              />
            </View>
          )}

          {/* Selection checkmark */}
          {selectable && isSelected && (
            <LinearGradient
              colors={[Colors.accent, Colors.accentDark]}
              style={styles.checkmark}
            >
              <Text style={styles.checkmarkText}>✓</Text>
            </LinearGradient>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    padding: GRID_PADDING,
  },
  columnWrapper: {
    gap: GAP,
    marginBottom: GAP,
  },
  photoContainer: {
    width: ITEM_WIDTH,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  photoPressable: {
    flex: 1,
  },
  photoWrapper: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '35%',
  },
  avatarContainer: {
    position: 'absolute',
    bottom: Spacing.xs,
    left: Spacing.xs,
  },
  checkmark: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
});

export default PhotoGrid;
