import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { Asset } from 'expo-asset';

interface WorldingLogoProps {
  width?: number;
  height?: number;
}

/**
 * WorldingLogo - horizontal brand mark for top-left header
 */
export function WorldingLogo({ width = 104, height = 20 }: WorldingLogoProps) {
  const asset = Asset.fromModule(require('../assets/images/worlding-logo-horizontal.svg'));

  return (
    <View style={styles.container}>
      <SvgUri
        width={width}
        height={height}
        uri={asset.uri}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    opacity: 0.9,
  },
});

export default WorldingLogo;
