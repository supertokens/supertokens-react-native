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
} from 'react-native';
import SuperTokens from "supertokens-react-native";
import loginWithGoogle from './google';
import { getAppleButton } from './apple';
import loginWithGithub from './github';
import SuccessView from './success-view';

// TODO: Replace this with your own IP
// NOTE: We use our IP (and not 10.0.2.2) here because of iOS
export const API_DOMAIN = "http://192.168.1.100:3001"

// Initialise SuperTokens
SuperTokens.init({
  apiDomain: `${API_DOMAIN}`,
});

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const signOut = async () => {
    await SuperTokens.signOut()
    setIsLoggedIn(false);
  }

  useEffect(() => {
    /*
      When the app loads we check if the user is already logged in using SuperTokens.doesSessionExist().
    */
    const checkForSession = async () => {
      if (await SuperTokens.doesSessionExist()) {
        setIsLoggedIn(true);
      }
    }

    checkForSession();
  }, []);


  if (isLoggedIn) {
    return (<SuccessView signOut={signOut} />);
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "white",
      }}>
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
        }}>

        {getAppleButton(setIsLoggedIn)}

        <View style={{
          height: 32,
        }} />

        <Button
          title={"Login with Google"}
          onPress={async () => {
            await loginWithGoogle();
            setIsLoggedIn(true);
          }} />

        <View style={{
          height: 32,
        }} />

        <Button
          title={"Login with Github"}
          onPress={async () => {
            await loginWithGithub();
            setIsLoggedIn(true);
          }} />
      </View>
    </SafeAreaView>
  );
};

export default App;
