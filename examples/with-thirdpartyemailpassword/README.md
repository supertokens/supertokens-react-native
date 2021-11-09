![SuperTokens banner](https://raw.githubusercontent.com/supertokens/supertokens-logo/master/images/Artboard%20%E2%80%93%2027%402x.png)

# SuperTokens ThirdPartyEmailPassword Demo app

This demo app demonstrates the following use cases:

-   Social Login / Sign up
-   Logout

## Project setup

Use `npm` to install the project dependencies:

```bash
npm install
```

#### iOS only

Install dependencies using cocoapods

```bash
cd iOS
pod install
cd ..
```

## Change API URL on the frontend
When making network calls to the server (explained in the next step) the demo app uses an IP address and not localhost (to avoid issues in iOS). 

- open `App.js`
- change the value of `API_DOMAIN` to match your machines local IP address

## Run the demo app

### Start the server
```bash
node server/index.js
```

The server starts on port 3001

If you would like to modify the API server (http://localhost:3001) URL:

-   Change the `apiDomain` and `apiPort` values in `server/index.js`
-   Change the `API_DOMAIN` value in `App.js`

### Run the app
```bash
# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

## Project structure & Parameters

-   The frontend code can be found in `App.js`.
-   Code for Google auth can be found in `google.js`
-   Code for Github auth can be found in `github.js`
-   Code for Sign in with Apple can be found in `apple.js`
-   The backend API is in the `server/index.js` file.

## Author

Created with :heart: by the folks at SuperTokens.io.

## License

This project is licensed under the Apache 2.0 license.