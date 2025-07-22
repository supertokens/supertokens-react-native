import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthHttpRequest from "./fetch";
import FrontToken from "./frontToken";
import NormalisedURLDomain from "./normalisedURLDomain";
import NormalisedURLPath from "./normalisedURLPath";
import { InputType, NormalisedInputType, EventHandler, RecipeInterface, TokenType } from "./types";
import { logDebugMessage } from "./logger";

const LAST_ACCESS_TOKEN_UPDATE = "st-last-access-token-update";
const REFRESH_TOKEN_NAME = "st-refresh-token";
const ACCESS_TOKEN_NAME = "st-access-token";

export function isAnIpAddress(ipaddress: string) {
    return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
        ipaddress
    );
}

export function normaliseURLDomainOrThrowError(input: string): string {
    let str = new NormalisedURLDomain(input).getAsStringDangerous();
    return str;
}

export function normaliseURLPathOrThrowError(input: string): string {
    return new NormalisedURLPath(input).getAsStringDangerous();
}

export function normaliseSessionScopeOrThrowError(cookieDomain: string): string {
    function helper(cookieDomain: string): string {
        cookieDomain = cookieDomain.trim().toLowerCase();

        // first we convert it to a URL so that we can use the URL class
        if (cookieDomain.startsWith(".")) {
            cookieDomain = cookieDomain.substr(1);
        }

        if (!cookieDomain.startsWith("http://") && !cookieDomain.startsWith("https://")) {
            cookieDomain = "http://" + cookieDomain;
        }

        try {
            let urlObj = new URL(cookieDomain);
            cookieDomain = urlObj.hostname;

            return cookieDomain;
        } catch (err) {
            throw new Error("Please provide a valid cookieDomain");
        }
    }

    function isAnIpAddress(ipaddress: string) {
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

export function validateAndNormaliseInputOrThrowError(options: InputType): NormalisedInputType {
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

    let sessionTokenBackendDomain: string | undefined = undefined;
    if (options.sessionTokenBackendDomain !== undefined) {
        sessionTokenBackendDomain = normaliseSessionScopeOrThrowError(options.sessionTokenBackendDomain);
    }

    let maxRetryAttemptsForSessionRefresh = 10;
    if (options.maxRetryAttemptsForSessionRefresh !== undefined) {
        if (options.maxRetryAttemptsForSessionRefresh < 0) {
            throw new Error("maxRetryAttemptsForSessionRefresh must be greater than or equal to 0.");
        }
        maxRetryAttemptsForSessionRefresh = options.maxRetryAttemptsForSessionRefresh;
    }

    let preAPIHook = async (context: {
        action: "SIGN_OUT" | "REFRESH_SESSION";
        requestInit: RequestInit;
        url: string;
    }): Promise<{ url: string; requestInit: RequestInit }> => {
        return { url: context.url, requestInit: context.requestInit };
    };
    if (options.preAPIHook !== undefined) {
        preAPIHook = options.preAPIHook;
    }

    let onHandleEvent: EventHandler = () => {};
    if (options.onHandleEvent !== undefined) {
        onHandleEvent = options.onHandleEvent;
    }

    let override: {
        functions: (originalImplementation: RecipeInterface) => RecipeInterface;
    } = {
        functions: oI => oI,
        ...options.override
    };

    let tokenTransferMethod = options.tokenTransferMethod !== undefined ? options.tokenTransferMethod : "header";

    return {
        apiDomain,
        apiBasePath,
        sessionExpiredStatusCode,
        autoAddCredentials,
        maxRetryAttemptsForSessionRefresh,
        sessionTokenBackendDomain,
        tokenTransferMethod,
        preAPIHook,
        onHandleEvent,
        override
    };
}

export function setToken(tokenType: TokenType, value: string) {
    const name = getStorageNameForToken(tokenType);
    logDebugMessage(`setToken: saved ${tokenType} token in storage`);
    // We save the tokens with a 100-year expiration time
    return storeInStorage(name, value, Date.now() + 3153600000);
}

export async function storeInStorage(name: string, value: string, expiry: number) {
    const storageKey = `st-storage-item-${name}`;
    if (value === "") {
        return await AsyncStorage.removeItem(storageKey);
    }

    return await AsyncStorage.setItem(storageKey, value);
}

/**
 * Last access token update is used to record the last time the access token had changed.
 * This is used to synchronise parallel calls to the refresh API to prevent multiple calls
 * to the refresh endpoint
 */
export async function saveLastAccessTokenUpdate() {
    logDebugMessage("saveLastAccessTokenUpdate: called");
    const now = Date.now().toString();

    logDebugMessage("saveLastAccessTokenUpdate: setting " + now);
    await storeInStorage(LAST_ACCESS_TOKEN_UPDATE, now, Number.MAX_SAFE_INTEGER);

    // We clear the sIRTFrontend cookie
    // We are handling this as a special case here because we want to limit the scope of legacy code
    await storeInStorage("sIRTFrontend", "", 0);
}

export function getStorageNameForToken(tokenType: TokenType) {
    switch (tokenType) {
        case "access":
            return ACCESS_TOKEN_NAME;
        case "refresh":
            return REFRESH_TOKEN_NAME;
    }
}

async function getFromStorage(name: string) {
    const itemInStorage = await AsyncStorage.getItem(`st-storage-item-${name}`);

    if (itemInStorage === null) {
        return undefined;
    }

    return itemInStorage;
}

export async function getTokenForHeaderAuth(tokenType: TokenType) {
    const name = getStorageNameForToken(tokenType);

    return getFromStorage(name);
}

export type LocalSessionState =
    | {
          status: "NOT_EXISTS" | "MAY_EXIST";
      }
    | {
          status: "EXISTS";
          // This is a number (timestamp) encoded as a string, but we never actually need to use it as number
          // We only use it for strict equal checks
          lastAccessTokenUpdate: string;
      };

/**
 * The web SDK has additional checks for this function. This difference is because
 * for the mobile SDKs there will never be a case where the fronttoken is undefined
 * but a session may still exist
 */
export async function getLocalSessionState(): Promise<LocalSessionState> {
    logDebugMessage("getLocalSessionState: called");
    const lastAccessTokenUpdate = await getFromStorage(LAST_ACCESS_TOKEN_UPDATE);
    const frontTokenExists = await FrontToken.doesTokenExists();
    if (frontTokenExists && lastAccessTokenUpdate !== undefined) {
        logDebugMessage(
            "getLocalSessionState: returning EXISTS since both frontToken and lastAccessTokenUpdate exists"
        );
        return { status: "EXISTS", lastAccessTokenUpdate: lastAccessTokenUpdate };
    } else {
        logDebugMessage(
            "getLocalSessionState: returning NOT_EXISTS since frontToken was cleared but lastAccessTokenUpdate exists"
        );
        return { status: "NOT_EXISTS" };
    }
}

export function fireSessionUpdateEventsIfNecessary(
    wasLoggedIn: boolean,
    status: number,
    frontTokenHeaderFromResponse: string | null | undefined
) {
    // In case we've received a 401 that didn't clear the session (e.g.: we've sent no session token, or we should try refreshing)
    // then onUnauthorised will handle firing the UNAUTHORISED event if necessary
    // In some rare cases (where we receive a 401 that also clears the session) this will fire the event twice.
    // This may be considered a bug, but it is the existing behaviour before the rework
    if (frontTokenHeaderFromResponse === undefined || frontTokenHeaderFromResponse === null) {
        // The access token (and the session) hasn't been updated.
        logDebugMessage("fireSessionUpdateEventsIfNecessary returning early because the front token was not updated");
        return;
    }

    // if the current endpoint clears the session it'll set the front-token to remove
    // any other update means it's created or updated.
    const frontTokenExistsAfter = frontTokenHeaderFromResponse !== "remove";

    logDebugMessage(
        `fireSessionUpdateEventsIfNecessary wasLoggedIn: ${wasLoggedIn} frontTokenExistsAfter: ${frontTokenExistsAfter} status: ${status}`
    );

    if (wasLoggedIn) {
        // we check for wasLoggedIn cause we don't want to fire an event
        // unnecessarily on first app load or if the user tried
        // to query an API that returned 401 while the user was not logged in...
        if (!frontTokenExistsAfter) {
            if (status === AuthHttpRequest.config.sessionExpiredStatusCode) {
                logDebugMessage("onUnauthorisedResponse: firing UNAUTHORISED event");
                AuthHttpRequest.config.onHandleEvent({
                    action: "UNAUTHORISED",
                    sessionExpiredOrRevoked: true
                });
            } else {
                logDebugMessage("onUnauthorisedResponse: firing SIGN_OUT event");
                AuthHttpRequest.config.onHandleEvent({
                    action: "SIGN_OUT"
                });
            }
        }
    } else if (frontTokenExistsAfter) {
        logDebugMessage("onUnauthorisedResponse: firing SESSION_CREATED event");
        AuthHttpRequest.config.onHandleEvent({
            action: "SESSION_CREATED"
        });
    }
}
