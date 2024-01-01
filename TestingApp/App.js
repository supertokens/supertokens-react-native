/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React from "react";
import { View, Text, Button } from "react-native";

import SuperTokens from "supertokens-react-native";
import axios from "axios";
SuperTokens.addAxiosInterceptors(axios);

const BASE_URL = "http://192.168.1.100:8080/";

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
                        flex: 1,
                        backgroundColor: "#000000"
                    }}
                />
            );
        } else if (this.state.loggedIn) {
            if (this.state.sessionVerified === undefined) {
                return (
                    <View
                        style={{
                            flex: 1,
                            backgroundColor: "#ff0000"
                        }}
                    />
                );
            } else if (this.state.sessionVerified) {
                return (
                    <View
                        style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center"
                        }}
                    >
                        <Text>Logged in, session verification passed!</Text>
                        <View style={{ height: 50 }} />
                        <Button title="Verify Fetch" onPress={this.sessionVerify} />
                        <View style={{ height: 50 }} />
                        <Button title="Verify Axios" onPress={this.sessionVerifyAxios} />
                        <View style={{ height: 50 }} />
                        <Button title="Logout Fetch" onPress={this.logout} />
                        <View style={{ height: 50 }} />
                        <Button title="Logout Axios" onPress={this.logoutAxios} />
                    </View>
                );
            } else {
                return (
                    <View
                        style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center"
                        }}
                    >
                        <Text>Logged in, session verification failed</Text>
                    </View>
                );
            }
        } else {
            return (
                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    <Button title="Login Fetch" onPress={this.login} />
                    <View style={{ height: 50 }} />
                    <Button title="Login Axios" onPress={this.loginAxios} />
                </View>
            );
        }
    }

    logoutAxios = async () => {
        let response = await axios.post(`${BASE_URL}logout`, {
            withCredentials: true
        });

        this.setState(oldState => {
            return {
                ...oldState,
                loggedIn: false
            };
        });
    };

    sessionVerifyAxios = () => {
        this.setState(
            oldState => {
                return {
                    ...oldState,
                    sessionVerified: undefined
                };
            },
            async () => {
                let response = await axios.get(`${BASE_URL}`, {
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
                        sessionVerified: resText === "rishabh"
                    };
                });
            }
        );
    };

    sessionVerify = () => {
        this.setState(
            oldState => {
                return {
                    ...oldState,
                    sessionVerified: undefined
                };
            },
            async () => {
                let response = await fetch(`${BASE_URL}`, {
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
                        sessionVerified: resText === "rishabh"
                    };
                });
            }
        );
    };

    logout = async () => {
        let response = await fetch(`${BASE_URL}logout`, {
            method: "post",
            credentials: "include"
        });

        this.setState(oldState => {
            return {
                ...oldState,
                loggedIn: false
            };
        });
    };

    loginAxios = async () => {
        let response = await axios.post(
            `${BASE_URL}login`,
            {
                userId: "rishabh"
            },
            {
                withCredentials: true
            }
        );

        this.setState(
            oldState => {
                return {
                    ...oldState,
                    loggedIn: true
                };
            },
            () => {
                this.sessionVerify();
            }
        );
    };

    login = async () => {
        let response = await fetch(`${BASE_URL}login`, {
            method: "post",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userId: "rishabh"
            })
        });

        this.setState(
            oldState => {
                return {
                    ...oldState,
                    loggedIn: true
                };
            },
            () => {
                this.sessionVerify();
            }
        );
    };

    componentDidMount() {
        SuperTokens.init({
            apiDomain: `${BASE_URL}`,
            sessionExpiredStatusCode: 440
        });
        this.checkLogin();
    }

    checkLogin = async () => {
        let loggedIn = await SuperTokens.doesSessionExist();
        this.setState(
            oldState => {
                return {
                    ...oldState,
                    loggedIn
                };
            },
            () => {
                if (this.state.loggedIn) {
                    this.sessionVerify();
                }
            }
        );
    };
}

export default App;
