import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParams } from '../../../navigation/stacks/rootStackParams';

export type OrderHistoryNavigationProp = NativeStackNavigationProp<
  RootStackParams,
  'bottomTab'
>;

export interface OrderHistoryProps {
  navigation?: OrderHistoryNavigationProp;
}
