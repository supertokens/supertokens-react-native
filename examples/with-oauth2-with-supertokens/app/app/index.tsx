import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri, useAuthRequest } from "expo-auth-session";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, View } from "react-native";
import Supertokens from "supertokens-react-native";
import { router } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

const AUTH_SERVER_URL = "REPLACE_WITH_YOUR_AUTH_SERVER_URL"; // For example: http://192.168.0.1:3006
export const API_SERVER_URL = "REPLACE_WITH_YOUR_API_SERVER_URL"; // For example: http://192.168.0.1:3001
const clientId = "REPLACE_WITH_YOUR_CLIENT_ID";
const redirectUri = makeRedirectUri({ native: "myapp://" });

Supertokens.init({
    apiDomain: API_SERVER_URL,
});

// Configure the AuthSession endpoint
const discovery = {
    authorizationEndpoint: `${AUTH_SERVER_URL}/auth/oauth/auth`,
    tokenEndpoint: `${AUTH_SERVER_URL}/auth/oauth/token`,
    userInfoEndpoint: `${AUTH_SERVER_URL}/auth/oauth/userinfo`,
};

export default function App() {
    const [loading, setLoading] = useState(false);
    const [request, response, promptAsync] = useAuthRequest(
        {
            clientId,
            scopes: ["openid", "email", "offline_access"],
            usePKCE: true,
            redirectUri,
            extraParams: {
                prompt: "login",
            },
        },
        discovery
    );

    useEffect(() => {
        const signIn = async (authorizationCode: string) => {
            try {
                const res = await fetch(`${API_SERVER_URL}/auth/oauth/client/signin`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        redirectURIInfo: {
                            redirectURI: redirectUri,
                            redirectURIQueryParams: {
                                code: authorizationCode,
                            },
                            pkceCodeVerifier: request?.codeVerifier,
                        },
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "OK") {
                        router.replace("/home");
                    } else {
                        console.error("Login Failed");
                    }
                }
            } catch (error) {
                console.log("error", error);
            }
        };

        if (response) {
            if (response.type === "error") {
                console.error("Authentication error", response.params.error_description || "something went wrong");
            }
            if (response.type === "success") {
                signIn(response.params.code);
            }
        }
    }, [discovery, request, response]);

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Button title="Login with SuperTokens" onPress={async () => {
                setLoading(true);
                promptAsync();
            }} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
});
