import * as WebBrowser from "expo-web-browser";
import {
    exchangeCodeAsync,
    fetchUserInfoAsync,
    makeRedirectUri,
    revokeAsync,
    TokenResponse,
    TokenResponseConfig,
    useAuthRequest
} from "expo-auth-session";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Button, Pressable, StyleSheet, Text, View } from "react-native";
import { useAsyncStorage } from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();

const AUTH_SERVER_URL = "REPLACE_WITH_YOUR_AUTH_SERVER_URL"; // For example: http://192.168.0.1:3006
const clientId = "REPLACE_WITH_YOUR_CLIENT_ID";
const redirectUri = makeRedirectUri({ native: "myapp://" });

const discovery = {
    authorizationEndpoint: `${AUTH_SERVER_URL}/auth/oauth/auth`,
    tokenEndpoint: `${AUTH_SERVER_URL}/auth/oauth/token`,
    userInfoEndpoint: `${AUTH_SERVER_URL}/auth/oauth/userinfo`,
    revocationEndpoint: `${AUTH_SERVER_URL}/auth/oauth/revoke`
};

export default function App() {
    // NOTE: Use a secure storage in production
    const {
        getItem: getTokensFromStorage,
        setItem: saveTokensInStorage,
        removeItem: removeTokensFromStorage
    } = useAsyncStorage("oauth2-tokens");

    const [loading, setLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userInfo, setUserInfo] = useState<Record<string, any> | null>(null);
    const [request, response, promptAsync] = useAuthRequest(
        {
            clientId,
            scopes: ["openid", "email", "offline_access"],
            usePKCE: true,
            redirectUri,
            extraParams: {
                prompt: "login",
            }
        },
        discovery
    );

    // Set the logged in status when the app loads
    useEffect(() => {
        (async () => {
            const accessToken = await getOAuth2AccessToken();
            setIsLoggedIn(!!accessToken);
            setLoading(false);
        })();
    }, []);


    // Exchange the code for an access token and refresh token
    useEffect(() => {
        const exchange = async (exchangeTokenReq: any) => {
            try {
                setLoading(true);
                const exchangeTokenResponse = await exchangeCodeAsync(
                    {
                        clientId,
                        code: exchangeTokenReq,
                        redirectUri,
                        extraParams: {
                            code_verifier: request?.codeVerifier!,
                        }
                    },
                    discovery
                );
                await saveTokensInStorage(JSON.stringify(exchangeTokenResponse.getRequestConfig()));
                setIsLoggedIn(true);
            } catch (error) {
                console.error("error", error);
            } finally {
                setLoading(false);
            }
        };

        if (response && !isLoggedIn) {
            if (response.type === "error") {
                console.error("Authentication error", response.params.error_description || "something went wrong");
            }
            if (response.type === "success") {
                exchange(response.params.code);
            }
        }
    }, [discovery, request, response]);

    // Get the access token from storage and refresh it if necessary
    const getOAuth2AccessToken = async (): Promise<string | null> => {
        const tokenString = await getTokensFromStorage();
        if (!tokenString) {
            return null;
        }
        let tokenConfig: TokenResponseConfig = JSON.parse(tokenString);
        const tokenResponse = new TokenResponse(tokenConfig);

        if (tokenResponse.shouldRefresh()) {
            const updatedTokenRes = await tokenResponse.refreshAsync({ clientId }, discovery);
            tokenConfig = updatedTokenRes.getRequestConfig();
            await saveTokensInStorage(JSON.stringify(tokenConfig));
        }

        return tokenResponse.accessToken;
    };

    const signOut = async () => {
        const authTokens = await getTokensFromStorage();
        if (authTokens) {
            const tokenConfig: TokenResponseConfig = JSON.parse(authTokens);
            const tokenResponse = new TokenResponse(tokenConfig);
            await revokeAsync({ clientId, token: tokenResponse.refreshToken! }, discovery);
            await removeTokensFromStorage();
        }

        setUserInfo(null);
        setIsLoggedIn(false);
    };

    const fetchUserInfo = async () => {
        const accessToken = await getOAuth2AccessToken();
        if (accessToken) {
            const userInfo = await fetchUserInfoAsync({ accessToken }, discovery);
            setUserInfo(userInfo);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!isLoggedIn) {
        return (
            <View style={styles.container}>
                <Button
                    title="Login with SuperTokens"
                    onPress={async () => {
                        setLoading(true);
                        promptAsync();
                    }}
                />
            </View>
        );
    }

    return <LoggedInPage signOut={signOut} fetchUserInfo={fetchUserInfo} userInfo={userInfo} />;
}

function LoggedInPage({
    signOut,
    fetchUserInfo,
    userInfo
}: {
    signOut: () => void;
    fetchUserInfo: () => void;
    userInfo: Record<string, any> | null;
}) {
    const insets = useSafeAreaInsets();
    return (
        <View
            style={{
                flex: 1,
                paddingTop: insets.top + 32,
                paddingBottom: insets.bottom + 32,
                paddingLeft: insets.left + 32,
                paddingRight: insets.right + 32,
                backgroundColor: "#ddd"
            }}
        >
            <Pressable onPress={signOut} style={styles.signOut}>
                <Text style={styles.buttonText}>Sign Out</Text>
            </Pressable>
            <View style={{ height: 16 }} />
            <View style={styles.contentContainer}>
                <View style={styles.contentHeader}>
                    <Text style={styles.contentHeaderTitle}>Login successful</Text>
                </View>
                <View style={{ height: 16 }} />
                <Pressable onPress={fetchUserInfo} style={styles.fetchUserInfo}>
                    <Text style={styles.buttonText}>Fetch User Info</Text>
                </Pressable>
                <View style={{ height: 24 }} />
            </View>
            <View style={{ height: 24 }} />
            {userInfo !== null && (
                <View style={styles.dataContainer}>
                    <Text>{JSON.stringify(userInfo, null, 2)}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 16
    },
    signOut: {
        backgroundColor: "#f93",
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
        borderRadius: 8,
        display: "flex",
        alignSelf: "flex-end"
    },
    buttonText: {
        color: "#fff"
    },
    contentContainer: {
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        alignItems: "center"
    },
    contentHeader: {
        backgroundColor: "#e7ffed",
        padding: 12,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%"
    },
    contentHeaderTitle: {
        color: "#3eb655",
        fontWeight: "bold"
    },
    fetchUserInfo: {
        backgroundColor: "#f93",
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
        borderRadius: 8
    },
    dataContainer: {
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        padding: 12,
        flex: 1
    }
});
