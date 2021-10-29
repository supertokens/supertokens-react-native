/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React, { useState, useEffect } from 'react';

import {
  Button,
  SafeAreaView,
  View,
  Text,
} from 'react-native';
import { authorize } from 'react-native-app-auth';
import axios from 'axios';
import SuperTokens from "supertokens-react-native";

// TODO: Replace this with your own IP
const BASE_URL = "http://192.168.1.101:3001"

SuperTokens.init({
  apiDomain: `${BASE_URL}`,
});

SuperTokens.addAxiosInterceptors(axios);

const USER_STATE_LOGGED_IN = "logged_in";
const USER_STATE_LOGGED_OUT = "logged_out";

const App = () => {
  const [userState, setUserState] = useState(USER_STATE_LOGGED_OUT);
  const [userInfo, setUserInfo] = useState({});

  const signOut = async () => {
    await SuperTokens.signOut()
    setUserState(USER_STATE_LOGGED_OUT);
  }

  const getSignedInScreen = () => {
    return (
      <SafeAreaView
        style={{
          flex: 1,
        }}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}>

          <Text style={{ marginBottom: 8 }}>Logged in Succesfully</Text>
          <Text style={{ marginBottom: 8 }}>New User: {`${userInfo.isNewuser}`}</Text>
          <Text style={{ marginBottom: 32 }}>Email: {userInfo.userEmail}</Text>
          <Button
            title="Sign out"
            onPress={signOut} />

        </View>
      </SafeAreaView>
    );
  }

  const loginWithGoogle = async () => {
    const config = {
      issuer: 'https://accounts.google.com',
      clientId: '1060725074195-c7mgk8p0h27c4428prfuo3lg7ould5o7.apps.googleusercontent.com',
      redirectUrl: 'com.demoapp:/oauthredirect',
      scopes: ["https://www.googleapis.com/auth/userinfo.email"]
    };

    let authState = await authorize(config);

    authState.access_token = authState.accessToken;
    delete authState.accessToken;

    let response = await axios.post(`${BASE_URL}/auth/signinup`, {
      redirectURI: "com.demoapp:/oauthredirect",
      thirdPartyId: "google",
      code: "DOESNT MATTER",
      authCodeResponse: authState,
    }, {
      headers: {
        rid: "thirdpartyemailpassword"
      }
    });

    if (response.data.status === "OK") {
      let isNewuser = response.data.createdNewUser;
      let userEmail = response.data.user.email;

      setUserState(USER_STATE_LOGGED_IN);
      setUserInfo({ ...userInfo, isNewuser, userEmail });
    }
  }

  const loginWithGithub = async () => {
    const clientId = "8a9152860ce869b64c44";
    const config = {
      redirectUrl: 'com.demoapp://oauthredirect',
      clientId: clientId,
      scopes: ["read:user", "user:email"],
      additionalHeaders: { 'Accept': 'application/json' },
      serviceConfiguration: {
        authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        tokenEndpoint: 'https://github.com/login/oauth/access_token',
        revocationEndpoint:
          'https://github.com/settings/connections/applications/' + clientId
      },
      skipCodeExchange: true,
    };

    let authState = await authorize(config);

    authState.access_token = authState.accessToken;
    delete authState.accessToken;

    let response = await axios.post(`${BASE_URL}/auth/signinup`, {
      redirectURI: "com.demoapp://oauthredirect",
      thirdPartyId: "github",
      code: authState.authorizationCode,
    }, {
      headers: {
        rid: "thirdpartyemailpassword"
      }
    });


    if (response.data.status === "OK") {
      let isNewuser = response.data.createdNewUser;
      let userEmail = response.data.user.email;

      setUserState(USER_STATE_LOGGED_IN);
      setUserInfo({ ...userInfo, isNewuser, userEmail });
    }
  }

  useEffect(() => {
    checkForSession();
  }, []);

  const checkForSession = async () => {
    if (await SuperTokens.doesSessionExist()) {
      setUserState(USER_STATE_LOGGED_IN);
    }
  }

  if (userState === USER_STATE_LOGGED_IN) {
    return getSignedInScreen();
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
      }}>
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
        }}>
        <Button
          title={"Login with Google"}
          onPress={loginWithGoogle} />

        <View style={{
          height: 32,
        }} />

        <Button
          title={"Login with Github"}
          onPress={loginWithGithub} />


      </View>
    </SafeAreaView>
  );
};

export default App;
