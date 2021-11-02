import { authorize } from 'react-native-app-auth';
import SuperTokens from "supertokens-react-native";
import { BASE_URL } from "./App";

import axios from 'axios';

// Adds request and response interceptors to the axios instance (Not required if using fetch)
SuperTokens.addAxiosInterceptors(axios);

/*
    We use react-native-app-auth to login with Google and then use the response to sign in with SuperTokens
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
    let authState = await authorize(config);

    // react-native-app-auth returns `accessToken` instead of `access_token`, we change this to follow the RFC.
    authState.access_token = authState.accessToken;
    delete authState.accessToken;

    /*
      We use the access_token returned by the Google servers to sign in the user and create a session using SuperTokens.
      Note that this route should already exist if your backend uses the SuperTokens SDK and has not changed the base path
      for APIs. 
     */
    await axios.post(`${BASE_URL}/auth/signinup`, {
        redirectURI: "com.demoapp:/oauthredirect",
        thirdPartyId: "google",
        code: "", // For this flow we rely on authCodeResponse to authenticate the user, so we pass an empty string for code
        authCodeResponse: authState,
    }, {
        headers: {
            rid: "thirdpartyemailpassword", // This is a temporary workaround, https://github.com/supertokens/supertokens-node/issues/202
        }
    });
}

export default loginWithGoogle;