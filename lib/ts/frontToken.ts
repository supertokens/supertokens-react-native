import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthHttpRequest from "./fetch";
import IdRefreshToken from "./idRefreshToken";

const FRONT_TOKEN_KEY = "supertokens-rn-front-token-key";
const FRONT_TOKEN_NAME = "sFrontToken";

export default class FrontToken {
    // these are waiters for when the idRefreshToken has been set, but this token has
    // not yet been set. Once this token is set or removed, the waiters are resolved.
    private static waiters: ((value: unknown) => void)[] = [];

    private constructor() {}

    static async getFrontToken(): Promise<string | null> {
        if (!(await AuthHttpRequest.recipeImpl.doesSessionExist(AuthHttpRequest.config))) {
            return null;
        }

        async function getFrontTokenFromStorage(): Promise<string | null> {
            let frontTokenFromStorage = await AsyncStorage.getItem(FRONT_TOKEN_KEY);

            if (frontTokenFromStorage !== null) {
                let value = "; " + frontTokenFromStorage;
                let parts = value.split("; " + FRONT_TOKEN_NAME + "=");

                let last = parts.pop();
                if (last !== undefined) {
                    let temp = last.split(";").shift();
                    if (temp === undefined) {
                        return null;
                    }
                    return temp;
                }
            }

            return null;
        }

        let token = await getFrontTokenFromStorage();
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
            if ((await IdRefreshToken.getIdRefreshToken(false)).status === "EXISTS") {
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

    static async setFrontToken(frontToken: string | undefined) {
        async function setFrontTokenToStorage(frontToken: string | undefined, domain: string) {
            let expires: string | undefined = "Thu, 01 Jan 1970 00:00:01 GMT";
            let cookieVal = "";
            if (frontToken !== undefined) {
                cookieVal = frontToken;
                expires = undefined; // set cookie without expiry
            }

            let valueToSet = undefined;

            if (expires !== undefined) {
                valueToSet = `${FRONT_TOKEN_NAME}=${cookieVal};expires=${expires};domain=${domain};path=/;samesite=lax`;
            } else {
                valueToSet = `${FRONT_TOKEN_NAME}=${cookieVal};domain=${domain};expires=Fri, 31 Dec 9999 23:59:59 GMT;path=/;samesite=lax`;
            }

            await AsyncStorage.setItem(FRONT_TOKEN_KEY, valueToSet);
        }

        await setFrontTokenToStorage(frontToken, "");
    }

    static async removeToken() {
        await this.setFrontToken(undefined);
        FrontToken.waiters.forEach(f => f(undefined));
        FrontToken.waiters = [];
    }

    static async setItem(frontToken: string) {
        await this.setFrontToken(frontToken);
        FrontToken.waiters.forEach(f => f(undefined));
        FrontToken.waiters = [];
    }
}
