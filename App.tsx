import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistedStore } from './src/services/redux/store';
import { LocationProvider } from './src/context/LocationContext';
import Navigation from './src/navigation';
import { Loader } from './src/components/componentsIndex';
import color from './src/theme/color';

const App: React.FC = () => {
  useEffect(() => {
    if (Platform.OS === 'android') {
      (StatusBar as any).setBackgroundColor?.(color.surface, true);
    }
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <Provider store={store}>
          <PersistGate
            loading={<Loader fullScreen message="Loading Medical App..." />}
            persistor={persistedStore}
          >
            <LocationProvider>
              <Navigation />
            </LocationProvider>
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
