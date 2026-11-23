import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParams } from '../../../navigation/stacks/rootStackParams';

export type OrderDetailRouteProp = RouteProp<RootStackParams, 'orderDetail'>;
export type OrderDetailNavigationProp = NativeStackNavigationProp<
  RootStackParams,
  'orderDetail'
>;

export interface OrderDetailProps {
  route?: OrderDetailRouteProp;
  navigation?: OrderDetailNavigationProp;
}
