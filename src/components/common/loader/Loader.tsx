import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { LoaderProps } from './loaderProps';
import { styles } from './loader.style';
import { color } from '@theme';

export const Loader: React.FC<LoaderProps> = ({
  message = 'Loading...',
  fullScreen = false,
}) => {
  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={color.primary} />
          {message ? <Text style={styles.text}>{message}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.inline}>
      <ActivityIndicator size="small" color={color.primary} />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
};

export default Loader;
