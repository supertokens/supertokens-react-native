import { authorize } from 'react-native-app-auth';
import SuperTokens from "supertokens-react-native";
import { API_DOMAIN } from "./App";

import axios from 'axios';

// Adds request and response interceptors to the axios instance (Not required if using fetch)
SuperTokens.addAxiosInterceptors(axios);

/*
    We use react-native-app-auth to login with Google and then use the response to sign in with SuperTokens.
    When we use authorize to communicate with Google, their servers respond with something similar to:
    {
        "accessToken": "<access_token>",
        "accessTokenExpirationDate": "2021-11-03T13:27:37Z",
        "authorizeAdditionalParameters": {...},
        "idToken": "<id_token>",
        "refreshToken": "<refresh_token",
        "scopes": [
            "email",
            "https://www.googleapis.com/auth/userinfo.email",
            "openid"
        ],
        "tokenAdditionalParameters": {},
        "tokenType": "Bearer"
    }

    We send this object to our backend /signinup API which will use the access_token to get the user's information
    and log the user into SuperTokens.
*/
const loginWithGoogle = async () => {
    // Full configuration options here: https://github.com/FormidableLabs/react-native-app-auth#config
    const config = {
        issuer: 'https://accounts.google.com',
        clientId: '1060725074195-c7mgk8p0h27c4428prfuo3lg7ould5o7.apps.googleusercontent.com',
        redirectUrl: 'com.demoapp:/oauthredirect',
        scopes: ["https://www.googleapis.com/auth/userinfo.email"]
    };

    // This will authenticate with Google and give us the access token to use with SuperTokens
    let authResult = await authorize(config);

    // react-native-app-auth returns `accessToken` instead of `access_token`, we change this to follow the RFC.
    authResult.access_token = authResult.accessToken;
    delete authResult.accessToken;

    /*
      We use the object returned by the Google servers to sign in the user and create a session using SuperTokens.
     */
    await axios.post(`${API_DOMAIN}/auth/signinup`, {
        redirectURI: "com.demoapp:/oauthredirect",
        thirdPartyId: "google",
        authCodeResponse: authResult,
    }, {
        headers: {
            rid: "thirdpartyemailpassword",
        }
    });
}

export default loginWithGoogle;