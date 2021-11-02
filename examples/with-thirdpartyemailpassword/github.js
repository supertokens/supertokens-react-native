import { authorize } from 'react-native-app-auth';
import SuperTokens from "supertokens-react-native";
import { BASE_URL } from "./App";
import axios from 'axios';

// Adds request and response interceptors to the axios instance (Not required if using fetch)
SuperTokens.addAxiosInterceptors(axios);

/*
    We use react-native-app-auth to login with Github and then use the response to sign in with SuperTokens
*/
const loginWithGithub = async () => {
    const clientId = "8a9152860ce869b64c44";
    // Full configuration options here: https://github.com/FormidableLabs/react-native-app-auth#config
    const config = {
        redirectUrl: 'com.demoapp://oauthredirect',
        clientId: clientId,
        scopes: ["read:user", "user:email"],
        additionalHeaders: { 'Accept': 'application/json' }, // For Github this is required
        serviceConfiguration: {
            authorizationEndpoint: 'https://github.com/login/oauth/authorize',
            tokenEndpoint: 'https://github.com/login/oauth/access_token',
            revocationEndpoint:
                'https://github.com/settings/connections/applications/' + clientId
        },
        skipCodeExchange: true, // This allows us to retrive the authorization code from Github and request for access token ourselves using SuperTokens
    };

    // Uses react-native-app-auth to authenticate with Github
    let authState = await authorize(config);

    /*
      We use the code returned by the Github servers to sign in the user and create a session using SuperTokens.
      Note that this route should already exist if your backend uses the SuperTokens SDK and has not changed the base path
      for APIs. 
     */
    await axios.post(`${BASE_URL}/auth/signinup`, {
        redirectURI: "com.demoapp://oauthredirect",
        thirdPartyId: "github",
        code: authState.authorizationCode,
    }, {
        headers: {
            rid: "thirdpartyemailpassword", // This is a temporary workaround, https://github.com/supertokens/supertokens-node/issues/202
        }
    });
}

export default loginWithGithub;