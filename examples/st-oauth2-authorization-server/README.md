![SuperTokens banner](https://raw.githubusercontent.com/supertokens/supertokens-logo/master/images/Artboard%20%E2%80%93%2027%402x.png)

# SuperTokens OAuth2 Authorization Server

This example app uses SuperTokens `OAuth2Provider` recipe to expose OAuth2 APIs. This app acts as an OAuth2 authorization server for other OAuth2 examples in this repo.

## Project setup

Clone the repo, enter the directory, and use `npm` to install the project dependencies:

```bash
git clone https://github.com/supertokens/supertokens-react-native
cd supertokens-react-native/examples/st-oauth2-authorization-server
npm install
```

## Set Up Frontend and Backend URLs

By default, the frontend runs at `http://localhost:3005`, and the backend at `http://localhost:3006`. You can customize these by setting the `REACT_APP_AUTH_SERVER_WEBSITE_URL` and `REACT_APP_AUTH_SERVER_API_URL` environment variables.

When running locally, we recommend using your local IP address as the domain to easily access these APIs from an emulator. On Mac/Linux, you can find your local IP with `ifconfig getifaddr en0`. If your IP is `10.64.21.128`, set the environment variables as follows:

```bash
export REACT_APP_AUTH_SERVER_WEBSITE_URL="http://10.64.21.128:3005"
export REACT_APP_AUTH_SERVER_API_URL="http://10.64.21.128:3006"
```

## Run the demo app

This compiles and serves the React app and starts the backend API server.

```bash
npm run start
```

## Author

Created with :heart: by the folks at supertokens.com.

## License

This project is licensed under the Apache 2.0 license.
