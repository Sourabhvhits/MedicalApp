import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from '@utility/navigationService';
import RootStack from './stacks/RootStack';

export const Navigation: React.FC = () => {
  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack />
    </NavigationContainer>
  );
};

export default Navigation;
