import { authorize } from "react-native-app-auth";
import SuperTokens from "supertokens-react-native";
import { API_DOMAIN } from "./App";
import axios from "axios";

// Adds request and response interceptors to the axios instance (Not required if using fetch)
SuperTokens.addAxiosInterceptors(axios);

/*
    We use react-native-app-auth to login with Github and then use the response to sign in with SuperTokens
    When we use authorize to communicate with Google, their servers respond with something similar to:

    {
        "accessToken": null,
        "additionalParameters": {},
        "authorizationCode": "<authorizationCode>",
        "codeVerifier": "<codeVerifier>",
        "idToken": null,
        "scopes": [],
        "tokenType": null,
    }

    We send the authorizationCode to our backend /signinup API. The API uses the code to fetch the access_token and
    user information, and logs the user into SuperTokens.
*/
const loginWithGithub = async () => {
    const clientId = "8a9152860ce869b64c44";
    // Full configuration options here: https://github.com/FormidableLabs/react-native-app-auth#config
    const config = {
        redirectUrl: "com.demoapp://oauthredirect",
        clientId: clientId,
        scopes: ["read:user", "user:email"],
        additionalHeaders: { Accept: "application/json" }, // For Github this is required
        serviceConfiguration: {
            authorizationEndpoint: "https://github.com/login/oauth/authorize",
            tokenEndpoint: "https://github.com/login/oauth/access_token",
            revocationEndpoint: "https://github.com/settings/connections/applications/" + clientId
        },
        skipCodeExchange: true // This allows us to retrieve the authorization code from Github and request for access token ourselves using SuperTokens
    };

    // Uses react-native-app-auth to authenticate with Github
    let authResult = await authorize(config);

    /*
      We use the authorizationCode returned by the Github servers to sign in the user and create a session using SuperTokens.
     */
    let signInUpResponse = await axios.post(
        `${API_DOMAIN}/auth/signinup`,
        {
            redirectURI: "com.demoapp://oauthredirect",
            thirdPartyId: "github",
            code: authResult.authorizationCode,
            clientId: "8a9152860ce869b64c44"
        },
        {
            headers: {
                rid: "thirdpartyemailpassword"
            }
        }
    );

    if (signInUpResponse.data.status !== "OK") {
        throw new Error("Github login failed");
    }
};

export default loginWithGithub;
