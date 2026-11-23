# React Native Project – Folder Structure Guide

Reference template taken from the **Impactbox-Mobile** project.
Use this file as the blueprint for every new React Native (CLI + TypeScript) project.

---

## 1. Tech Stack (base)

| Area | Library |
|---|---|
| Core | React Native CLI (TypeScript) |
| Navigation | `@react-navigation/native`, `native-stack`, `bottom-tabs`, `drawer` |
| State | `@reduxjs/toolkit`, `react-redux`, `redux-persist` + `@react-native-async-storage/async-storage` |
| API | `axios` (one shared instance with interceptors) |
| Forms | `formik` + `yup` |
| Icons | `react-native-svg` (icons as TSX components) |
| Toast | `react-native-snackbar` |
| Path alias | `babel-plugin-module-resolver` + `tsconfig.json` `paths` |
| Gesture / Safe area | `react-native-gesture-handler`, `react-native-safe-area-context` |

---

## 2. Root Level

```
ProjectName/
├── android/                  # Native Android project
├── ios/                      # Native iOS project
├── __tests__/                # Jest tests
├── src/                      # ALL app code lives here
├── App.tsx                   # Providers (Gesture, SafeArea, Redux, PersistGate, Context) + <Route />
├── index.js                  # AppRegistry entry (also imports global setup like fontScaling)
├── app.json
├── babel.config.js           # module-resolver aliases
├── tsconfig.json             # same aliases as "paths"
├── metro.config.js
├── react-native.config.js    # links custom fonts (assets: ['./src/assets/fonts'])
├── .eslintrc.js / .prettierrc.js
└── package.json
```

---

## 3. `src/` Structure

```
src/
├── assets/
│   ├── fonts/                     # .ttf files (e.g. Poppins-Regular.ttf ...)
│   ├── images/                    # .png / .jpg
│   ├── svg/                       # each icon = one TSX component
│   │   ├── BackIcon.tsx
│   │   ├── <feature>/             # optional sub-group (e.g. profile/, layer/)
│   ├── imageIndex.ts              # export default { logo: require('./images/logo.png'), ... }
│   └── svgIndex.ts                # imports all svg icons, exports them named + default -> @svgIndex
│
├── components/
│   ├── common/                    # generic reusable UI (Button, Input, Header, Loader, Dropdown ...)
│   │   └── button/
│   │       ├── Button.tsx
│   │       ├── button.style.ts
│   │       ├── buttonProps.d.ts
│   │       └── useButton.ts       # only if the component has logic
│   ├── card/                      # list/card items (JobCard, NewsCard ...)
│   │   └── jobCard/
│   │       ├── JobCard.tsx
│   │       ├── jobCard.style.ts
│   │       ├── jobCardProps.d.ts
│   │       └── jobCard.const.ts   # optional static data
│   ├── componentsIndex.ts         # barrel export of all common components  -> @components
│   └── cardIndex.ts               # barrel export of all cards              -> @card
│
├── context/                       # React Context providers (e.g. StepContext.tsx)
│
├── hooks/                         # app-wide hooks
│   ├── useAppNavigation.ts        # typed useNavigation / useRoute
│   ├── useRedux.ts                # typed useAppDispatch / useAppSelector
│   ├── useAppState.ts             # app foreground/background
│   └── useDebounce.ts
│
├── navigation/
│   ├── index.tsx                  # <NavigationContainer ref={navigationRef}> + RootStack
│   ├── stackParams.d.ts
│   ├── stacks/
│   │   ├── RootStack.tsx          # native stack: auth screens + drawer + detail screens
│   │   └── rootStackParams.d.ts   # type RootStackParams = { login: undefined; jobDetails: { id: string } ... }
│   ├── drawer/
│   │   ├── AppDrawer.tsx
│   │   └── customDrawer/          # same component pattern (tsx, style, props, hook, const)
│   └── bottomTab/
│       ├── BottomTab.tsx
│       └── bottomTab.style.ts
│
├── screens/
│   ├── auth/                      # login, register, forgot, otpVerify, resetPassword ...
│   │   └── login/
│   │       ├── Login.tsx          # UI only
│   │       ├── useLogin.ts        # all logic: useFormik, API calls, navigation
│   │       ├── login.formik.ts    # initialValues + Yup formSchema (+ form values type)
│   │       ├── login.style.ts     # StyleSheet
│   │       └── loginProps.d.ts    # types (optional)
│   └── home/                      # every screen after login, one folder per screen
│       └── jobDetails/
│           ├── JobDetails.tsx
│           ├── useJobDetails.ts
│           ├── jobDetails.style.ts
│           ├── jobDetailsProps.d.ts
│           └── jobDetails.const.ts
│
├── services/
│   ├── api/
│   │   ├── api.ts                 # axios.create({ baseURL }) + request/response interceptors (token, refresh, 401)
│   │   └── index.ts               # export { axiosInstance }
│   ├── config/
│   │   ├── constant.ts            # baseURL, imageURL, deep links, keys, API endpoint names
│   │   └── params.ts              # request param/key names used in FormData / body
│   └── redux/
│       ├── store.ts               # configureStore + persistReducer + persistStore
│       ├── rootReducer.ts         # combineReducers({ userReducer, ... })
│       ├── type.ts                # RootState interface
│       └── userReducer/
│           ├── reducer.ts         # createSlice (loginSuccess, logout ...)
│           └── interface.ts       # UserReducerState type
│
├── theme/
│   ├── color.ts                   # export default { primary: '#396AB2', white: '#fff', ... }
│   ├── font.ts                    # font family names
│   ├── spacing.ts                 # screenGutter, cardGap ...
│   ├── defaultStyles.ts           # shared styles (pageContainer, centerContainer ...)
│   └── index.ts                   # export { color, font, defaultStyles, spacing }
│
└── utility/
    ├── validation/
    │   ├── stringValidation.ts
    │   └── validationMessage.ts
    ├── responsive.ts              # responsiveFont / responsiveWidth / responsiveHeight
    ├── fontScaling.ts             # disables system font scaling (imported in index.js)
    ├── navigationService.ts       # navigationRef + navigate/reset outside components
    ├── toast.ts                   # Toast(text, bgColor) + ToastError / ToastSuccess / ToastWarning (Snackbar)
    ├── log.ts                     # dev-only logger
    └── common.ts                  # small helper functions
```

---

## 4. Naming Rules

| Item | Rule | Example |
|---|---|---|
| Folder of screen/component | camelCase | `jobDetails/`, `searchInput/` |
| Component / Screen file | PascalCase | `JobDetails.tsx` |
| Logic hook | `use` + PascalCase | `useJobDetails.ts` |
| Style file | `<name>.style.ts`, export `styles` | `jobDetails.style.ts` |
| Props / types | `<name>Props.d.ts` | `jobDetailsProps.d.ts` |
| Static data | `<name>.const.ts` | `jobDetails.const.ts` |
| Form config (Formik + Yup) | `<name>.formik.ts`, export `initialValues`, `formSchema` | `login.formik.ts` |
| SVG icon | PascalCase + `Icon` | `BackIcon.tsx` |
| Reducer folder | `<name>Reducer/` with `reducer.ts` + `interface.ts` | `userReducer/` |

**Rule: 1 screen = 1 folder.** UI in `.tsx`, logic in `use*.ts`, form config in `.formik.ts`, styles in `.style.ts`, types in `Props.d.ts`.

---

## 5. Screen Pattern (UI + Hook split)

```ts
// screens/auth/login/login.formik.ts
import * as Yup from 'yup';

// isLoading lives in the form values -> setFieldValue('isLoading', true/false)
const initialValues = {
  identifier: '',
  password: '',
  isLoading: false,
};

const formSchema = Yup.object().shape({
  identifier: Yup.string().trim().required('Email or mobile number is required'),
  password: Yup.string().required('Password is required'),
});

export { formSchema, initialValues };
export type LoginFormValues = typeof initialValues;
```

```ts
// screens/auth/login/useLogin.ts
import { useFormik } from 'formik';
import { initialValues, formSchema } from './login.formik';

const useLogin = () => {
  const navigation = useAuthNavigation();
  const dispatch = useAppDispatch();

  const formik = useFormik({
    initialValues,
    validationSchema: formSchema,
    onSubmit: async (values, { setFieldValue }) => {
      setFieldValue('isLoading', true);
      try {
        const res = await axiosInstance.post(constant.login, values);
        dispatch(loginSuccess(res.data.data));
      } catch (e: any) {
        ToastError(cleanErrorMessage(e, 'Something went wrong'));
      } finally {
        setFieldValue('isLoading', false);
      }
    },
  });

  const navigateToRegister = () => navigation.navigate('register');

  return { formik, loading: formik.values.isLoading, navigateToRegister };
};
export default useLogin;
```

```tsx
// screens/auth/login/Login.tsx
import { styles } from './login.style';
import useLogin from './useLogin';
import { Button, Input } from '@components';

const Login = () => {
  const { formik, loading } = useLogin();
  return (
    <View style={styles.container}>
      <Input
        label="Email or Mobile Number"
        value={formik.values.identifier}
        onChangeText={formik.handleChange('identifier')}
        onBlur={formik.handleBlur('identifier')}
        error={formik.touched.identifier ? formik.errors.identifier : undefined}
      />
      <Button title="Sign In" onPress={() => formik.handleSubmit()} loading={loading} />
    </View>
  );
};
export default Login;
```

```ts
// screens/auth/login/login.style.ts
import { StyleSheet } from 'react-native';
import { color, font } from '@theme';
import { responsiveFont } from '@utility/responsive';

export const styles = StyleSheet.create({
  title: { fontFamily: font.PoppinsSemiBold, fontSize: responsiveFont(20), color: color.black },
});
```

---

## 6. Path Aliases

### `babel.config.js`
```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.json', '.ts', '.tsx'],
        alias: {
          '@context': './src/context',
          '@imageIndex': './src/assets/imageIndex.ts',
          '@svgIndex': './src/assets/svgIndex.ts',
          '@components': './src/components/componentsIndex.ts',
          '@commonComponents': './src/components/common',
          '@card': './src/components/cardIndex.ts',
          '@hooks': './src/hooks',
          '@navigation': './src/navigation',
          '@screens': './src/screens',
          '@redux': './src/services/redux',
          '@api': './src/services/api',
          '@config': './src/services/config',
          '@theme': './src/theme',
          '@utility': './src/utility',
        },
      },
    ],
    // 'react-native-reanimated/plugin' / 'react-native-worklets/plugin' must stay LAST if used
  ],
};
```

### `tsconfig.json`
```json
{
  "extends": "@react-native/typescript-config/tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@context/*": ["./src/context/*"],
      "@imageIndex": ["./src/assets/imageIndex.ts"],
      "@svgIndex": ["./src/assets/svgIndex.ts"],
      "@components": ["./src/components/componentsIndex.ts"],
      "@commonComponents/*": ["./src/components/common/*"],
      "@card": ["./src/components/cardIndex.ts"],
      "@hooks/*": ["./src/hooks/*"],
      "@navigation/*": ["./src/navigation/*"],
      "@screens/*": ["./src/screens/*"],
      "@redux/*": ["./src/services/redux/*"],
      "@api/*": ["./src/services/api/*"],
      "@config/*": ["./src/services/config/*"],
      "@theme": ["./src/theme/index.ts"],
      "@utility/*": ["./src/utility/*"]
    }
  },
  "exclude": ["node_modules", "ios", "android"]
}
```

> Keep babel and tsconfig aliases **in sync**. After changing aliases run `npx react-native start --reset-cache`.

### Import examples
```ts
import { Button, Input, Header } from '@components';
import { JobCard } from '@card';
import { MailIcon, LockIcon } from '@svgIndex';   // or: import svgIndex from '@svgIndex'
import imageIndex from '@imageIndex';
import { color, font, spacing, defaultStyles } from '@theme';
import { axiosInstance } from '@api/api';
import constant from '@config/constant';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { loginSuccess } from '@redux/userReducer/reducer';
import { ToastError, ToastSuccess } from '@utility/toast';
import { initialValues, formSchema } from './login.formik';   // same-folder files stay relative
```

**Import rules**
- Always use the aliases above for anything outside the current folder. Never use `../`.
- Use relative `./` imports only for files in the same screen/component folder (`./login.style`, `./useLogin`, `./login.formik`).
- Files inside `src/theme/` import each other with `./`. Don't import the `@theme` barrel there, because that creates a circular import.
- Theme values come from the barrel: `import { color } from '@theme'`, not `theme/color`.
- Icons come from `@svgIndex`, not `assets/svg/<Icon>`.

---

## 7. Core Files (starter code)

### `App.tsx`
```tsx
const App = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <Provider store={store}>
        <PersistGate persistor={persistedStore}>
          <Route />
        </PersistGate>
      </Provider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);
```

### `services/redux/store.ts`
```ts
const persistConfig = { key: 'root', version: 1, storage: AsyncStorage };
const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: gdm =>
    gdm({ serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] } }),
});
export type AppDispatch = typeof store.dispatch;
export const persistedStore = persistStore(store);
```

### `hooks/useRedux.ts`
```ts
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### `hooks/useAppNavigation.ts`
```ts
export const useAuthNavigation = <T extends keyof RootStackParams = keyof RootStackParams>() =>
  useNavigation<NativeStackNavigationProp<RootStackParams, T>>();

export const useAuthRoute = <T extends keyof RootStackParams>() =>
  useRoute<RouteProp<RootStackParams, T>>();
```

### `services/api/api.ts`
```ts
const axiosInstance = axios.create({ baseURL: constant.baseURL });

axiosInstance.interceptors.request.use(config => {
  const { token } = store.getState().userReducer;
  if (token) config.headers.auth = token;
  return config;
});

axiosInstance.interceptors.response.use(
  res => res,
  async error => {
    // 401 -> refresh token once, retry; if refresh fails -> logout + navigateAndSimpleReset('login')
    return Promise.reject(error);
  },
);
export { axiosInstance };
```

### `utility/navigationService.ts`
```ts
export const navigationRef = createNavigationContainerRef<RootStackParams>();
export const navigate = (name: any, params?: any) =>
  navigationRef.isReady() && navigationRef.navigate(name, params);
```

### `theme/index.ts`
```ts
import color from './color';
import font from './font';
import { defaultStyles } from './defaultStyles';
import spacing from './spacing';
export { color, font, defaultStyles, spacing };
```

---

## 8. Navigation Flow

```
NavigationContainer (navigation/index.tsx)
└── RootStack (native stack)
    ├── auth screens: login, register, forgot, otpVerify ...
    ├── drawer  (AppDrawer + CustomDrawer)
    │   └── bottomTab (BottomTab + CustomBottomTab)
    │       ├── home
    │       ├── ...tabs
    └── detail / full-screen pages: jobDetails, settings ...
```

---

## 9. Checklist – Adding Something New

**New screen**
1. Create `src/screens/home/<screenName>/` with `ScreenName.tsx`, `useScreenName.ts`, `screenName.style.ts` (+ `Props.d.ts`, `.const.ts` if needed).
   - Screen has a form? Add `screenName.formik.ts` (`initialValues` + Yup `formSchema`) and use `useFormik` inside `useScreenName.ts`.
2. Add the route + params type in `navigation/stacks/rootStackParams.d.ts`.
3. Register it in `navigation/stacks/RootStack.tsx` (or BottomTab / Drawer).

**New reusable component**
1. Create `src/components/common/<name>/` (or `card/<name>/`) with tsx + style + props.
2. Export it from `componentsIndex.ts` (or `cardIndex.ts`).

**New icon / image**
- SVG → add TSX in `assets/svg/`, export from `svgIndex.ts`.
- PNG/JPG → put in `assets/images/`, add `require` in `imageIndex.ts`.

**New API**
- Add endpoint name to `services/config/constant.ts`; call it with `axiosInstance` inside the screen's `use*.ts` hook.

**New global state**
- Create `services/redux/<name>Reducer/` (`reducer.ts` + `interface.ts`), add to `rootReducer.ts` and to `RootState` in `type.ts`.

---

## 10. Quick Setup Commands for a New Project

```bash
npx @react-native-community/cli init MyApp
cd MyApp

# folders
mkdir -p src/{assets/{fonts,images,svg},components/{common,card},context,hooks,navigation/{stacks,drawer,bottomTab},screens/{auth,home},services/{api,config,redux/userReducer},theme,utility/validation}

# core libs
npm i @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs @react-navigation/drawer \
  react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated \
  @reduxjs/toolkit react-redux redux-persist @react-native-async-storage/async-storage \
  axios formik yup react-native-svg react-native-snackbar moment

npm i -D babel-plugin-module-resolver

cd ios && pod install && cd ..
```

Then copy the `babel.config.js` and `tsconfig.json` aliases from section 6, link fonts via `react-native.config.js`, and run `npx react-native-asset`.
