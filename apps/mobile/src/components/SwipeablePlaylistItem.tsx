import React, { useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { List, IconButton } from 'react-native-paper';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { hapticFeedback } from '../utils/haptics';

interface SwipeablePlaylistItemProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  onDelete: () => void;
  onLongPress?: () => void;
}

export default function SwipeablePlaylistItem({
  title,
  subtitle,
  onPress,
  onDelete,
  onLongPress,
}: SwipeablePlaylistItemProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const handlePress = () => {
    hapticFeedback.light();
    onPress();
  };

  const handleLongPress = () => {
    hapticFeedback.medium();
    onLongPress?.();
  };

  const handleDelete = () => {
    hapticFeedback.warning();
    swipeableRef.current?.close();
    onDelete();
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightAction}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <IconButton
            icon="delete"
            iconColor="#fff"
            size={24}
            onPress={handleDelete}
            style={styles.deleteButton}
          />
        </Animated.View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
      >
        <List.Item
          title={title}
          description={subtitle}
          onPress={handlePress}
          onLongPress={handleLongPress}
          left={(props) => <List.Icon {...props} icon="playlist-music" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          style={styles.listItem}
        />
      </Swipeable>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  listItem: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  rightAction: {
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
  },
  deleteButton: {
    margin: 0,
  },
});
