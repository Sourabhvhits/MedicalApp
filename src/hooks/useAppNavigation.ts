import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParams } from '@navigation/stacks/rootStackParams';

export const useAuthNavigation = <T extends keyof RootStackParams = keyof RootStackParams>() =>
  useNavigation<NativeStackNavigationProp<RootStackParams, T>>();

export const useAuthRoute = <T extends keyof RootStackParams>() =>
  useRoute<RouteProp<RootStackParams, T>>();

export default useAuthNavigation;
