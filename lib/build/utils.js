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
import { URL } from "react-native-url-polyfill";
import AuthHttpRequest from "./fetch";
import FrontToken from "./frontToken";
import NormalisedURLDomain from "./normalisedURLDomain";
import NormalisedURLPath from "./normalisedURLPath";
const LAST_ACCESS_TOKEN_UPDATE = "st-last-access-token-update";
const REFRESH_TOKEN_NAME = "st-refresh-token";
const ACCESS_TOKEN_NAME = "st-access-token";
export function isAnIpAddress(ipaddress) {
    return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
        ipaddress
    );
}
export function normaliseURLDomainOrThrowError(input) {
    let str = new NormalisedURLDomain(input).getAsStringDangerous();
    return str;
}
export function normaliseURLPathOrThrowError(input) {
    return new NormalisedURLPath(input).getAsStringDangerous();
}
export function normaliseCookieDomainOrThrowError(cookieDomain) {
    function helper(cookieDomain) {
        cookieDomain = cookieDomain.trim().toLowerCase();
        // first we convert it to a URL so that we can use the URL class
        if (cookieDomain.startsWith(".")) {
            cookieDomain = cookieDomain.substr(1);
        }
        if (!cookieDomain.startsWith("http://") && !cookieDomain.startsWith("https://")) {
            cookieDomain = "http://" + cookieDomain;
        }
        try {
            // @ts-ignore (Typescript complains that URL does not expect a parameter in constructor even though it does for react-native-url-polyfill)
            let urlObj = new URL(cookieDomain);
            cookieDomain = urlObj.hostname;
            // remove leading dot
            if (cookieDomain.startsWith(".")) {
                cookieDomain = cookieDomain.substr(1);
            }
            return cookieDomain;
        } catch (err) {
            throw new Error("Please provide a valid cookieDomain");
        }
    }
    function isAnIpAddress(ipaddress) {
        return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
            ipaddress
        );
    }
    let noDotNormalised = helper(cookieDomain);
    if (noDotNormalised === "localhost" || isAnIpAddress(noDotNormalised)) {
        return noDotNormalised;
    }
    if (cookieDomain.startsWith(".")) {
        return "." + noDotNormalised;
    }
    return noDotNormalised;
}
export function validateAndNormaliseInputOrThrowError(options) {
    let apiDomain = normaliseURLDomainOrThrowError(options.apiDomain);
    let apiBasePath = normaliseURLPathOrThrowError("/auth");
    if (options.apiBasePath !== undefined) {
        apiBasePath = normaliseURLPathOrThrowError(options.apiBasePath);
    }
    let sessionExpiredStatusCode = 401;
    if (options.sessionExpiredStatusCode !== undefined) {
        sessionExpiredStatusCode = options.sessionExpiredStatusCode;
    }
    let autoAddCredentials = true;
    if (options.autoAddCredentials !== undefined) {
        autoAddCredentials = options.autoAddCredentials;
    }
    let sessionTokenBackendDomain = undefined;
    if (options.sessionTokenBackendDomain !== undefined) {
        sessionTokenBackendDomain = normaliseCookieDomainOrThrowError(options.sessionTokenBackendDomain);
    }
    let preAPIHook = context =>
        __awaiter(this, void 0, void 0, function*() {
            return { url: context.url, requestInit: context.requestInit };
        });
    if (options.preAPIHook !== undefined) {
        preAPIHook = options.preAPIHook;
    }
    let onHandleEvent = () => {};
    if (options.onHandleEvent !== undefined) {
        onHandleEvent = options.onHandleEvent;
    }
    let override = Object.assign({ functions: oI => oI }, options.override);
    let tokenTransferMethod = options.tokenTransferMethod !== undefined ? options.tokenTransferMethod : "header";
    return {
        apiDomain,
        apiBasePath,
        sessionExpiredStatusCode,
        autoAddCredentials,
        sessionTokenBackendDomain,
        tokenTransferMethod,
        preAPIHook,
        onHandleEvent,
        override
    };
}
export function setToken(tokenType, value) {
    const name = getStorageNameForToken(tokenType);
    // We save the tokens with a 100-year expiration time
    return storeInStorage(name, value, Date.now() + 3153600000);
}
export function storeInStorage(name, value, expiry) {
    return __awaiter(this, void 0, void 0, function*() {
        const storageKey = `st-storage-item-${name}`;
        if (value === "") {
            return yield AsyncStorage.removeItem(storageKey);
        }
        return yield AsyncStorage.setItem(storageKey, value);
    });
}
/**
 * Last access token update is used to record the last time the access token had changed.
 * This is used to synchronise parallel calls to the refresh API to prevent multiple calls
 * to the refresh endpoint
 */
export function saveLastAccessTokenUpdate() {
    return __awaiter(this, void 0, void 0, function*() {
        const now = Date.now().toString();
        yield storeInStorage(LAST_ACCESS_TOKEN_UPDATE, now, Number.MAX_SAFE_INTEGER);
        // We clear the sIRTFrontend cookie
        // We are handling this as a special case here because we want to limit the scope of legacy code
        yield storeInStorage("sIRTFrontend", "", 0);
    });
}
export function getStorageNameForToken(tokenType) {
    switch (tokenType) {
        case "access":
            return ACCESS_TOKEN_NAME;
        case "refresh":
            return REFRESH_TOKEN_NAME;
    }
}
function getFromStorage(name) {
    return __awaiter(this, void 0, void 0, function*() {
        const itemInStorage = yield AsyncStorage.getItem(`st-storage-item-${name}`);
        if (itemInStorage === null) {
            return undefined;
        }
        return itemInStorage;
    });
}
export function getTokenForHeaderAuth(tokenType) {
    return __awaiter(this, void 0, void 0, function*() {
        const name = getStorageNameForToken(tokenType);
        return getFromStorage(name);
    });
}
/**
 * The web SDK has additional checks for this function. This difference is because
 * for the mobile SDKs there will never be a case where the fronttoken is undefined
 * but a session may still exist
 */
export function getLocalSessionState() {
    return __awaiter(this, void 0, void 0, function*() {
        const lastAccessTokenUpdate = yield getFromStorage(LAST_ACCESS_TOKEN_UPDATE);
        const frontTokenExists = yield FrontToken.doesTokenExists();
        if (frontTokenExists && lastAccessTokenUpdate !== undefined) {
            return { status: "EXISTS", lastAccessTokenUpdate: lastAccessTokenUpdate };
        } else {
            return { status: "NOT_EXISTS" };
        }
    });
}
export function fireSessionUpdateEventsIfNecessary(wasLoggedIn, status, frontTokenHeaderFromResponse) {
    // In case we've received a 401 that didn't clear the session (e.g.: we've sent no session token, or we should try refreshing)
    // then onUnauthorised will handle firing the UNAUTHORISED event if necessary
    // In some rare cases (where we receive a 401 that also clears the session) this will fire the event twice.
    // This may be considered a bug, but it is the existing behaviour before the rework
    if (frontTokenHeaderFromResponse === undefined || frontTokenHeaderFromResponse === null) {
        // The access token (and the session) hasn't been updated.
        return;
    }
    // if the current endpoint clears the session it'll set the front-token to remove
    // any other update means it's created or updated.
    const frontTokenExistsAfter = frontTokenHeaderFromResponse !== "remove";
    if (wasLoggedIn) {
        // we check for wasLoggedIn cause we don't want to fire an event
        // unnecessarily on first app load or if the user tried
        // to query an API that returned 401 while the user was not logged in...
        if (!frontTokenExistsAfter) {
            if (status === AuthHttpRequest.config.sessionExpiredStatusCode) {
                AuthHttpRequest.config.onHandleEvent({
                    action: "UNAUTHORISED",
                    sessionExpiredOrRevoked: true
                });
            } else {
                AuthHttpRequest.config.onHandleEvent({
                    action: "SIGN_OUT"
                });
            }
        }
    } else if (frontTokenExistsAfter) {
        AuthHttpRequest.config.onHandleEvent({
            action: "SESSION_CREATED"
        });
    }
}
