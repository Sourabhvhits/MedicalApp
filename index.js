/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { disableFontScaling } from '@utility/fontScaling';

// Disable OS uncontrolled font scaling to maintain consistent typography
disableFontScaling();

AppRegistry.registerComponent(appName, () => App);
