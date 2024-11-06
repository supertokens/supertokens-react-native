![SuperTokens banner](https://raw.githubusercontent.com/supertokens/supertokens-logo/master/images/Artboard%20%E2%80%93%2027%402x.png)

# Example App with SuperTokens Auth and SuperTokens as OAuth2 Provider

This example app shows how to use SuperTokens as an OAuth2 provider in a React app that already implements SuperTokens Auth, utilizing the `OAuth2Client` recipe on the backend.

## Project setup

Clone the repo, enter the directory, and use `npm` to install the project dependencies:

```bash
git clone https://github.com/supertokens/supertokens-react-native
cd supertokens-react-native/examples/with-oauth2-with-supertokens

cd app
npm install

cd backend
npm install
```

## 1. Get your Redirect URI 

You can get the `redirectUri` by logging the `redirectUri` variable in `app/app/index.tsx`. This usually looks like `exp://192.168.0.1:8081` where `192.168.0.1` is your local IP address.


## 2. Create an OAuth2 Client

Update the `redirect_uris` value by the `redirectUri` you got in step 1.

```bash
curl -X POST http://localhost:4445/admin/clients \
     -H "Content-Type: application/json" \
     -d '{
           "scope": "offline_access openid email",
           "redirect_uris": ["exp://192.168.0.1:8081"],
           "access_token_strategy": "jwt",
           "token_endpoint_auth_method": "none",
           "grant_types": ["authorization_code", "refresh_token"],
           "response_types": ["code", "id_token"],
           "skip_consent": true
         }'
```

Note down the `client_id` from the response.

## 3. Run the st-oauth2-authorization-server

1. Open a new terminal window and navigate to `supertokens-react-native/examples/
st-oauth2-authorization-server`
2. Read the README.md to setup `st-oauth2-authorization-server ` and run it using `npm start`

## 4. Run the backend server

1. Open a new terminal window and navigate to `supertokens-react-native/examples/with-oauth2-with-supertokens/backend`
2. Update the `cliendId` in `backend/config.ts`
3. Run `npm start`

## 5. Update app config

Update `clientId`, `AUTH_SERVER_URL` and `API_SERVER_URL` values as per step 2, 3 and 4 in `app/app/index.tsx`.

## 6. Run the app.

1. Open a new terminal window and navigate to `supertokens-react-native/examples/with-oauth2-with-supertokens/app`
2. Run `npm start`

## Author

Created with :heart: by the folks at supertokens.com.

## License

This project is licensed under the Apache 2.0 license.
