import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthHttpRequest from "./fetch";
import { decode as atob } from "base-64";
import { getLocalSessionState, saveLastAccessTokenUpdate } from "./utils";

const FRONT_TOKEN_KEY = "supertokens-rn-front-token-key";
const FRONT_TOKEN_NAME = "sFrontToken";

export default class FrontToken {
    // these are waiters for when the idRefreshToken has been set, but this token has
    // not yet been set. Once this token is set or removed, the waiters are resolved.
    private static waiters: ((value: unknown) => void)[] = [];

    private constructor() {}

    private static async getFrontTokenFromStorage(): Promise<string | null> {
        let frontTokenFromStorage = await AsyncStorage.getItem(FRONT_TOKEN_KEY);

        if (frontTokenFromStorage !== null) {
            return frontTokenFromStorage;
        }

        return null;
    }

    static async getFrontToken(): Promise<string | null> {
        if ((await getLocalSessionState()).status !== "EXISTS") {
            return null;
        }

        let token = await this.getFrontTokenFromStorage();
        return token;
    }

    static async getTokenInfo(): Promise<
        | {
              uid: string;
              ate: number;
              up: any;
          }
        | undefined
    > {
        let frontToken = await this.getFrontToken();
        if (frontToken === null) {
            if ((await getLocalSessionState()).status === "EXISTS") {
                // this means that the id refresh token has been set, so we must
                // wait for this to be set or removed
                await new Promise(resolve => {
                    FrontToken.waiters.push(resolve);
                });
                return FrontToken.getTokenInfo();
            } else {
                return undefined;
            }
        }
        return JSON.parse(decodeURIComponent(escape(atob(frontToken))));
    }

    private static async setFrontToken(frontToken: string | undefined) {
        async function setFrontTokenToStorage(frontToken: string | undefined) {
            if (frontToken === undefined) {
                await FrontToken.removeToken();
            } else {
                await AsyncStorage.setItem(FRONT_TOKEN_KEY, frontToken);
            }
        }

        await setFrontTokenToStorage(frontToken);
    }

    static async removeToken() {
        await this.setFrontToken(undefined);
        FrontToken.waiters.forEach(f => f(undefined));
        FrontToken.waiters = [];
    }

    static async setItem(frontToken: string) {
        // We update the refresh attempt info here as well, since this means that we've updated the session in some way
        // This could be both by a refresh call or if the access token was updated in a custom endpoint
        // By saving every time the access token has been updated, we cause an early retry if
        // another request has failed with a 401 with the previous access token and the token still exists.
        // Check the start and end of onUnauthorisedResponse
        // As a side-effect we reload the anti-csrf token to check if it was changed by another tab.

        await saveLastAccessTokenUpdate();

        if (frontToken === "remove") {
            return FrontToken.removeToken();
        }

        await this.setFrontToken(frontToken);
        FrontToken.waiters.forEach(f => f(undefined));
        FrontToken.waiters = [];
    }

    static async doesTokenExists() {
        const frontToken = await this.getFrontTokenFromStorage();
        return frontToken !== null;
    }
}
