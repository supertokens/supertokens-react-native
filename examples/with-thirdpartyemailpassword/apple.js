import React from "react";
import { Button, Platform } from "react-native";
import { appleAuth, appleAuthAndroid } from "@invertase/react-native-apple-authentication";
import SuperTokens from "supertokens-react-native";
import { API_DOMAIN } from "./App";
import axios from "axios";

// Adds request and response interceptors to the axios instance (Not required if using fetch)
SuperTokens.addAxiosInterceptors(axios);

/*
    We use @invertase/react-native-apple-authentication to sign in with Apple and then use the authorizationCode to sign in using SuperTokens
*/
const loginWithApple = async () => {
    /* 
      For login with apple we use @invertase/react-native-apple-authentication which defaults to the apple built in 
      methods for iOS.

      For android it works similar to how Apple sign in works on the web and other platforms, read more here:
      https://github.com/invertase/react-native-apple-authentication
    */
    let authCode;

    /*
      For iOS your app's bundle identifier is always used as the client id. When configuring Sign in with Apple on the 
      Apple developer dashboard make sure to enable sign in with apple for your App ID to make sure this works on iOS correctly. 
      (If this step is skipped or wrong values are configured, when signing in you should see an error for "Sign up not completed". 
      This error message usually means that the bundle identifier for your app does not match the one configured on the dashboard)
    */
    if (Platform.OS === "ios") {
        let appleAuthRequestResponse = await appleAuth.performRequest({
            requestedOperation: appleAuth.Operation.LOGIN,
            requestedScopes: [appleAuth.Scope.EMAIL]
        });

        authCode = appleAuthRequestResponse.authorizationCode;

        /*
          We use the code returned by the Apple servers to sign in the user and create a session using SuperTokens. We then send the clientType along with the request to indicate to the backend which provider should be used to sign in the user.

          NOTE: The clientType must match the one set in the backend
        */
        let signInUpResponse = await axios.post(
            `${API_DOMAIN}/auth/signinup`,
            {
                redirectURIInfo: {
                    redirectURIOnProviderDashboard: "com.demoapp:/oauthredirect",
                    redirectURIQueryParams: {
                        code: authCode
                    }
                },
                thirdPartyId: "apple",
                clientType: "ios"
            },
            {
                headers: {
                    rid: "thirdpartyemailpassword" // This is a temporary workaround, https://github.com/supertokens/supertokens-node/issues/202
                }
            }
        );

        if (signInUpResponse.data.status !== "OK") {
            throw new Error("Apple login failed");
        }
    } else {
        // Read more about this configuration here: https://github.com/invertase/react-native-apple-authentication
        /*
            For Android we create a Service ID on the Apple dashboard and then use that as the client ID when trying to sign in
        */
        appleAuthAndroid.configure({
            clientId: "io.supertokens.example.service",
            redirectUri: "https://supertokens.io/dev/oauth/redirect-to-app",
            responseType: appleAuthAndroid.ResponseType.CODE,
            scope: appleAuthAndroid.Scope.EMAIL
        });

        let authResponse = await appleAuthAndroid.signIn();

        authCode = authResponse.code;

        /*
          We use the code returned by the Apple servers to sign in the user and create a session using SuperTokens.

          NOTE: The clientType must match the one set in the backend
        */
        let signInUpResponse = await axios.post(
            `${API_DOMAIN}/auth/signinup`,
            {
                redirectURIInfo: {
                    redirectURIOnProviderDashboard: "https://supertokens.io/dev/oauth/redirect-to-app",
                    redirectURIQueryParams: {
                        code: authCode
                    }
                },
                thirdPartyId: "apple",
                clientType: "service"
            },
            {
                headers: {
                    rid: "thirdpartyemailpassword" // This is a temporary workaround, https://github.com/supertokens/supertokens-node/issues/202
                }
            }
        );

        if (signInUpResponse.data.status !== "OK") {
            throw new Error("Apple login failed");
        }
    }
};

export const getAppleButton = setIsLoggedIn => {
    /* 
      For Android, Apple sign in requires API level 19 and above. 
      You can use appleAuthAndroid.isSupported to check if the device supports Apple sign in
    */
    if (Platform.OS === "ios" || appleAuthAndroid.isSupported) {
        return (
            <Button
                title={"Login with Apple"}
                onPress={async () => {
                    await loginWithApple();
                    setIsLoggedIn(true);
                }}
            />
        );
    } else {
        return null;
    }
};
