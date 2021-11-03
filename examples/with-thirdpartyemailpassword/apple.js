import React from 'react';
import {
    Button,
    Platform,
} from 'react-native';
import { appleAuth, appleAuthAndroid } from '@invertase/react-native-apple-authentication';
import SuperTokens from "supertokens-react-native";
import { BASE_URL } from "./App";
import axios from 'axios';

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
      Apple developer dashboard make sure to enable sign in with apple for your App ID to make sure this works on iOS correctly. (If this step is skipped or wrong values are configured, when signing in you should see an error for "Sign up not completed". This error message usually means that the bundle identifier for your app does not match the one
      configured on the dashboard)

      For Android (and other platforms), you need to create a Service ID on the Apple dashboard and use that as your client_id
    */
    if (Platform.OS === "ios") {
        let appleAuthRequestResponse = await appleAuth.performRequest({
            requestedOperation: appleAuth.Operation.LOGIN,
            requestedScopes: [appleAuth.Scope.EMAIL],

        });

        authCode = appleAuthRequestResponse.authorizationCode;

        /*
          We use the code returned by the Apple servers to sign in the user and create a session using SuperTokens.
          Note that this route should already exist if your backend uses the SuperTokens SDK and has not changed the base path
          for APIs. 

          NOTE: For iOS the client_id should always match your app's bundle identifier (while for Android, Web and other platforms you need to use a service ID). To achieve this in a convenient way we pass our bundle identifier when calling our signinup route.
        */
        await axios.post(`${BASE_URL}/auth/signinup`, {
            redirectURI: "com.demoapp:/oauthredirect",
            thirdPartyId: "apple",
            code: authCode,
            clientId: "4398792-io.supertokens.example",
        }, {
            headers: {
                rid: "thirdpartyemailpassword", // This is a temporary workaround, https://github.com/supertokens/supertokens-node/issues/202
            }
        });
    } else {
        // Read more about this configuration here: https://github.com/invertase/react-native-apple-authentication
        appleAuthAndroid.configure({
            clientId: 'io.supertokens.example.service',
            redirectUri: 'https://supertokens.io/dev/oauth/redirect-to-app',
            responseType: appleAuthAndroid.ResponseType.CODE,
            scope: appleAuthAndroid.Scope.EMAIL,
        });

        let authResponse = await appleAuthAndroid.signIn();

        authCode = authResponse.code;

        /*
          We use the code returned by the Apple servers to sign in the user and create a session using SuperTokens.
          Note that this route should already exist if your backend uses the SuperTokens SDK and has not changed the base path
          for APIs. 
        */
        await axios.post(`${BASE_URL}/auth/signinup`, {
            redirectURI: "https://supertokens.io/dev/oauth/redirect-to-app",
            thirdPartyId: "apple",
            code: authCode,
        }, {
            headers: {
                rid: "thirdpartyemailpassword", // This is a temporary workaround, https://github.com/supertokens/supertokens-node/issues/202
            }
        });
    }
}

export const getAppleButton = (setIsLoggedIn) => {
    /* 
      For Android, Apple sign in requires API level 19 and above. 
      You can use appleAuthAndroid.isSupported to check if the device supports Apple sign in
    */
    if (Platform.OS === "ios" || appleAuthAndroid.isSupported) {
        return <Button
            title={"Login with Apple"}
            onPress={async () => {
                await loginWithApple();
                setIsLoggedIn(true);
            }} />
    } else {
        return null;
    }
}