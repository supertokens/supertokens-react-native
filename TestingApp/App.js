/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  Button
} from 'react-native';

import {
  Header,
  LearnMoreLinks,
  Colors,
  DebugInstructions,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';
import SuperTokensSession from "supertokens-react-native"
import SuperTokensSessionAxios from "supertokens-react-native/axios";
import axios from "axios";
SuperTokensSessionAxios.makeSuper(axios);

class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      loggedIn: undefined,
      sessionVerified: undefined
    };
  }

  render() {
    if (this.state.loggedIn === undefined) {
      return (
        <View
          style={{
            flex: 1, backgroundColor: "#000000"
          }} />
      );
    } else if (this.state.loggedIn) {
      if (this.state.sessionVerified === undefined) {
        return (
          <View
            style={{
              flex: 1, backgroundColor: "#ff0000"
            }} />
        );
      } else if (this.state.sessionVerified) {
        return (
          <View
            style={{
              flex: 1, alignItems: "center", justifyContent: "center"
            }}>
            <Text>
              Logged in, session verification passed!
            </Text>
            <View style={{ height: 50 }} />
            <Button
              title="Verify Fetch"
              onPress={this.sessionVerify} />
            <View style={{ height: 50 }} />
            <Button
              title="Verify Axios"
              onPress={this.sessionVerifyAxios} />
            <View style={{ height: 50 }} />
            <Button
              title="Logout Fetch"
              onPress={this.logout} />
            <View style={{ height: 50 }} />
            <Button
              title="Logout Axios"
              onPress={this.logoutAxios} />
          </View>
        )
      } else {
        return (
          <View
            style={{
              flex: 1, alignItems: "center", justifyContent: "center"
            }}>
            <Text>
              Logged in, session verification failed
          </Text>
          </View>
        );
      }
    } else {
      return (
        <View
          style={{
            flex: 1, alignItems: "center", justifyContent: "center"
          }}>
          <Button
            title="Login Fetch"
            onPress={this.login} />
          <View style={{ height: 50 }} />
          <Button
            title="Login Axios"
            onPress={this.loginAxios} />
        </View>
      );
    }
  }

  logoutAxios = async () => {
    let response = await axios.post("http://192.168.1.112:8080/logout", {
      withCredentials: true,
    });

    this.setState(oldState => {
      return {
        ...oldState,
        loggedIn: false
      }
    });
  }

  sessionVerifyAxios = () => {
    this.setState(oldState => {
      return {
        ...oldState,
        sessionVerified: undefined
      }
    }, async () => {
      let response = await axios.get("http://192.168.1.112:8080/", {
        withCredentials: true
      });

      if (response.status === 440) {
        this.logout();
        return;
      }

      let resText = await response.data;
      this.setState(oldState => {
        return {
          ...oldState,
          sessionVerified: resText === "success"
        }
      });
    });
  }

  sessionVerify = () => {
    this.setState(oldState => {
      return {
        ...oldState,
        sessionVerified: undefined
      }
    }, async () => {
      let response = await fetch("http://192.168.1.112:8080/", {
        method: "get",
        credentials: "include"
      });

      if (response.status === 440) {
        this.logout();
        return;
      }

      let resText = await response.text();
      this.setState(oldState => {
        return {
          ...oldState,
          sessionVerified: resText === "success"
        }
      });
    });
  }

  logout = async () => {
    let response = await fetch("http://192.168.1.112:8080/logout", {
      method: "post",
      credentials: "include",
    });

    this.setState(oldState => {
      return {
        ...oldState,
        loggedIn: false
      }
    });
  }

  loginAxios = async () => {
    let response = await axios.post("http://192.168.1.112:8080/login", {
      userId: "rishabh"
    }, {
        withCredentials: true
      });

    this.setState(oldState => {
      return {
        ...oldState,
        loggedIn: true
      }
    }, () => {
      this.sessionVerify();
    });
  }

  login = async () => {
    let response = await fetch("http://192.168.1.112:8080/login", {
      method: "post",
      credentials: "include",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: "rishabh"
      })
    });

    this.setState(oldState => {
      return {
        ...oldState,
        loggedIn: true
      }
    }, () => {
      this.sessionVerify();
    });
  }

  componentDidMount() {
    SuperTokensSession.init("http://192.168.1.112:8080/refresh", 440, true);
    SuperTokensSessionAxios.init("http://192.168.1.112:8080/refresh", 440);
    this.checkLogin();
  }

  checkLogin = async () => {
    let loggedIn = await SuperTokensSession.doesSessionExist();
    this.setState((oldState) => {
      return {
        ...oldState,
        loggedIn
      };
    }, () => {
      if (this.state.loggedIn) {
        this.sessionVerify();
      }
    });
  }

}

export default App;
