var __awaiter =
    (this && this.__awaiter) ||
    function(thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function(resolve) {
                      resolve(value);
                  });
        }
        return new (P || (P = Promise))(function(resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }
            function rejected(value) {
                try {
                    step(generator["throw"](value));
                } catch (e) {
                    reject(e);
                }
            }
            function step(result) {
                result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
            }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode as atob } from "base-64";
import { getLocalSessionState, saveLastAccessTokenUpdate } from "./utils";
const FRONT_TOKEN_KEY = "supertokens-rn-front-token-key";
const FRONT_TOKEN_NAME = "sFrontToken";
export default class FrontToken {
    constructor() {}
    static getFrontTokenFromStorage() {
        return __awaiter(this, void 0, void 0, function*() {
            let frontTokenFromStorage = yield AsyncStorage.getItem(FRONT_TOKEN_KEY);
            if (frontTokenFromStorage !== null) {
                let value = "; " + frontTokenFromStorage;
                let parts = value.split("; " + FRONT_TOKEN_NAME + "=");
                let last = parts.pop();
                if (last !== undefined) {
                    let splitForExpiry = frontTokenFromStorage.split(";");
                    let expiry = Date.parse(splitForExpiry[1].split("=")[1]);
                    let currentTime = Date.now();
                    if (expiry < currentTime) {
                        yield FrontToken.removeToken();
                        return null;
                    }
                    let temp = last.split(";").shift();
                    if (temp === undefined) {
                        return null;
                    }
                    return temp;
                }
            }
            return null;
        });
    }
    static getFrontToken() {
        return __awaiter(this, void 0, void 0, function*() {
            if (!((yield getLocalSessionState()).status === "EXISTS")) {
                return null;
            }
            let token = yield this.getFrontTokenFromStorage();
            return token;
        });
    }
    static getTokenInfo() {
        return __awaiter(this, void 0, void 0, function*() {
            let frontToken = yield this.getFrontToken();
            if (frontToken === null) {
                if ((yield getLocalSessionState()).status === "EXISTS") {
                    // this means that the id refresh token has been set, so we must
                    // wait for this to be set or removed
                    yield new Promise(resolve => {
                        FrontToken.waiters.push(resolve);
                    });
                    return FrontToken.getTokenInfo();
                } else {
                    return undefined;
                }
            }
            return JSON.parse(decodeURIComponent(escape(atob(frontToken))));
        });
    }
    static setFrontToken(frontToken) {
        return __awaiter(this, void 0, void 0, function*() {
            function setFrontTokenToStorage(frontToken, domain) {
                return __awaiter(this, void 0, void 0, function*() {
                    let expires = "Thu, 01 Jan 1970 00:00:01 GMT";
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
                    yield AsyncStorage.setItem(FRONT_TOKEN_KEY, valueToSet);
                });
            }
            yield setFrontTokenToStorage(frontToken, "");
        });
    }
    static removeToken() {
        return __awaiter(this, void 0, void 0, function*() {
            yield this.setFrontToken(undefined);
            FrontToken.waiters.forEach(f => f(undefined));
            FrontToken.waiters = [];
        });
    }
    static setItem(frontToken) {
        return __awaiter(this, void 0, void 0, function*() {
            // We update the refresh attempt info here as well, since this means that we've updated the session in some way
            // This could be both by a refresh call or if the access token was updated in a custom endpoint
            // By saving every time the access token has been updated, we cause an early retry if
            // another request has failed with a 401 with the previous access token and the token still exists.
            // Check the start and end of onUnauthorisedResponse
            // As a side-effect we reload the anti-csrf token to check if it was changed by another tab.
            yield saveLastAccessTokenUpdate();
            if (frontToken === "remove") {
                return FrontToken.removeToken();
            }
            yield this.setFrontToken(frontToken);
            FrontToken.waiters.forEach(f => f(undefined));
            FrontToken.waiters = [];
        });
    }
    static doesTokenExists() {
        return __awaiter(this, void 0, void 0, function*() {
            const frontToken = yield this.getFrontTokenFromStorage();
            return frontToken !== null;
        });
    }
}
// these are waiters for when the idRefreshToken has been set, but this token has
// not yet been set. Once this token is set or removed, the waiters are resolved.
FrontToken.waiters = [];
