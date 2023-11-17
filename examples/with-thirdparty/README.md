# SuperTokens Example App

## Add dependencies

This example uses requires the following dependencies:

- [@invertase/react-native-apple-authentication](https://github.com/invertase/react-native-apple-authentication)
- [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage)
- [@react-native-google-signin/google-signin](https://github.com/react-native-google-signin/google-signin)
- [react-native-app-auth](https://github.com/FormidableLabs/react-native-app-auth)
- [supertokens-react-native](https://github.com/supertokens/supertokens-react-native)

```bash
npm install supertokens-react-native react-native-app-auth @invertase/react-native-apple-authentication
npx expo install @react-native-google-signin/google-signin
npx expo install @react-native-async-storage/async-storage
```

This example uses Expo, you can refer to the documentation of the libraries to see the command to install them in a plain React Native project.

This example app needed to prebuild the iOS and Android native code because it required custom native code. Refer to the Expo docs to know more.

## Setup

### Google

- Create OAuth credentials for iOS on [Google cloud console](https://console.cloud.google.com/)
- Create OAuth credentials for Web on [Google cloud console](https://console.cloud.google.com/). This is required because we need to get the authorization code in the app to be able to use SuperTokens. You need to provide all values (including domains and URLs) for Google login to work, you can use dummy values if you do not have a web application.
- Replace all occurences of `GOOGLE_IOS_CLIENT_ID` with the client id for iOS in the app's code (including the info.plist)
- Replace `GOOGLE_IOS_URL_SCHEME` with the value of `GOOGLE_IOS_CLIENT_ID` in reverse, for example if the iOS client id is `com.org.scheme` the value you want to set is `scheme.org.com`. Google cloud console will provide a way to copy the URL scheme to make this easier.
- Replace all occurences of `GOOGLE_WEB_CLIENT_ID` with the client id for Web in both the iOS code (including the info.plist) and the backend code
- Replace all occurences of `GOOGLE_WEB_CLIENT_SECRET` with the client secret in the backend code

### Github

- Create credentials for an OAuth app from Github Developer Settings
- Use com.supertokens.supertokensexample://oauthredirect when configuring the Authorization callback URL. If you are using your own redirect url be sure to update the performGithubLogin function in `github.ts`
- Replace all occurences of `GITHUB_CLIENT_ID` in both the frontend and backend
- Replace all occurences of `GITHUB_CLIENT_SECRET` in the backend code

### Apple

- Add the Sign in with Apple capability for your app's primary target. This is already done for this example app so no steps are needed.
- If you are not using Xcode's automatic signing you will need to manually add the capability against your bundle id in Apple's dashboard.
- Replace all occurrences of `APPLE_CLIENT_ID`. This should match your bundle id
- Replace all occurrences of `APPLE_KEY_ID`. You will need to create a new key with the Sign in with Apple capability on Apple's dashboard.
- Replace all occurences of `APPLE_PRIVATE_KEY`, when you create a key there will be an option to download the private key. You can only download this once.
- Replace all occurrences of `APPLE_TEAM_ID` with your Apple developer account's team id

**In this example app, sign in with Apple is only available on iOS**

## Running the app

- Replace the value of the API domain in `constants.ts` and `/backend/config.ts` to match your machines local IP address
- Navigate to the `/backend` folder and run `npm run start`
- Run the app by running either `npm run ios` or `npm run android` depending on what platform you want to run on.

## How it works

- On app launch we check if a session exists and redirect to login if it doesnt
- We initialise SuperTokens which also adds interceptors for `fetch`
- After logging in we call APIs exposed by the SuperTokens backend SDKs to create a session and redirect to the home screen
- On the home screen we call a protected API to fetch session information
