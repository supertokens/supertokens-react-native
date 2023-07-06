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
import AuthHttpRequest, { onUnauthorisedResponse } from "./fetch";
import FrontToken from "./frontToken";
import { supported_fdi } from "./version";
import { interceptorFunctionRequestFulfilled, responseErrorInterceptor, responseInterceptor } from "./axios";
import { SuperTokensGeneralError } from "./error";
import { getLocalSessionState, normaliseCookieDomainOrThrowError, normaliseURLDomainOrThrowError } from "./utils";
export default function RecipeImplementation() {
    return {
        addFetchInterceptorsAndReturnModifiedFetch: function(originalFetch, _) {
            return function(url, config) {
                return __awaiter(this, void 0, void 0, function*() {
                    return yield AuthHttpRequest.doRequest(
                        config => {
                            return originalFetch(url, Object.assign({}, config));
                        },
                        config,
                        url
                    );
                });
            };
        },
        addAxiosInterceptors: function(axiosInstance, _) {
            // we first check if this axiosInstance already has our interceptors.
            let requestInterceptors = axiosInstance.interceptors.request;
            for (let i = 0; i < requestInterceptors.handlers.length; i++) {
                if (requestInterceptors.handlers[i].fulfilled === interceptorFunctionRequestFulfilled) {
                    return;
                }
            }
            // Add a request interceptor
            axiosInstance.interceptors.request.use(interceptorFunctionRequestFulfilled, function(error) {
                return __awaiter(this, void 0, void 0, function*() {
                    throw error;
                });
            });
            // Add a response interceptor
            axiosInstance.interceptors.response.use(
                responseInterceptor(axiosInstance),
                responseErrorInterceptor(axiosInstance)
            );
        },
        getUserId: function(config) {
            return __awaiter(this, void 0, void 0, function*() {
                let tokenInfo = yield FrontToken.getTokenInfo();
                if (tokenInfo === undefined) {
                    throw new Error("No session exists");
                }
                return tokenInfo.uid;
            });
        },
        getAccessTokenPayloadSecurely: function(config) {
            return __awaiter(this, void 0, void 0, function*() {
                let tokenInfo = yield FrontToken.getTokenInfo();
                if (tokenInfo === undefined) {
                    throw new Error("No session exists");
                }
                if (tokenInfo.ate < Date.now()) {
                    let retry = yield AuthHttpRequest.attemptRefreshingSession();
                    if (retry) {
                        return yield this.getAccessTokenPayloadSecurely(config);
                    } else {
                        throw new Error("Could not refresh session");
                    }
                }
                return tokenInfo.up;
            });
        },
        doesSessionExist: function(config) {
            return __awaiter(this, void 0, void 0, function*() {
                const tokenInfo = yield FrontToken.getTokenInfo();
                if (tokenInfo === undefined) {
                    return false;
                }
                if (tokenInfo.ate < Date.now()) {
                    const preRequestLocalSessionState = yield getLocalSessionState();
                    const refresh = yield onUnauthorisedResponse(preRequestLocalSessionState);
                    return refresh.result === "RETRY";
                }
                return true;
            });
        },
        signOut: function(config) {
            return __awaiter(this, void 0, void 0, function*() {
                if (!(yield this.doesSessionExist(config))) {
                    config.onHandleEvent({
                        action: "SIGN_OUT"
                    });
                    return;
                }
                let preAPIResult = yield config.preAPIHook({
                    action: "SIGN_OUT",
                    requestInit: {
                        method: "post",
                        headers: {
                            "fdi-version": supported_fdi.join(","),
                            rid: AuthHttpRequest.rid
                        }
                    },
                    url: AuthHttpRequest.signOutUrl
                });
                let resp = yield fetch(preAPIResult.url, preAPIResult.requestInit);
                if (resp.status === config.sessionExpiredStatusCode) {
                    // refresh must have already sent session expiry event
                    return;
                }
                if (resp.status >= 300) {
                    throw resp;
                }
                let responseJson = yield resp.clone().json();
                if (responseJson.status === "GENERAL_ERROR") {
                    let message =
                        responseJson.message === undefined ? "No Error Message Provided" : responseJson.message;
                    throw new SuperTokensGeneralError(message);
                }
                // we do not send an event here since it's triggered in fireSessionUpdateEventsIfNecessary.
            });
        },
        shouldDoInterceptionBasedOnUrl: (toCheckUrl, apiDomain, sessionTokenBackendDomain) => {
            function isNumeric(str) {
                if (typeof str != "string") return false; // we only process strings!
                return (
                    !isNaN(str) && !isNaN(parseFloat(str)) // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
                ); // ...and ensure strings of whitespace fail
            }
            toCheckUrl = normaliseURLDomainOrThrowError(toCheckUrl);
            // @ts-ignore (Typescript complains that URL does not expect a parameter in constructor even though it does for react-native-url-polyfill)
            let urlObj = new URL(toCheckUrl);
            let domain = urlObj.hostname;
            if (sessionTokenBackendDomain === undefined) {
                domain = urlObj.port === "" ? domain : domain + ":" + urlObj.port;
                apiDomain = normaliseURLDomainOrThrowError(apiDomain);
                // @ts-ignore (Typescript complains that URL does not expect a parameter in constructor even though it does for react-native-url-polyfill)
                let apiUrlObj = new URL(apiDomain);
                return (
                    domain === (apiUrlObj.port === "" ? apiUrlObj.hostname : apiUrlObj.hostname + ":" + apiUrlObj.port)
                );
            } else {
                let normalisedSessionDomain = normaliseCookieDomainOrThrowError(sessionTokenBackendDomain);
                if (sessionTokenBackendDomain.split(":").length > 1) {
                    // this means that a port may have been provided
                    let portStr = sessionTokenBackendDomain.split(":")[sessionTokenBackendDomain.split(":").length - 1];
                    if (isNumeric(portStr)) {
                        normalisedSessionDomain += ":" + portStr;
                        domain = urlObj.port === "" ? domain : domain + ":" + urlObj.port;
                    }
                }
                if (sessionTokenBackendDomain.startsWith(".")) {
                    return ("." + domain).endsWith(normalisedSessionDomain);
                } else {
                    return domain === normalisedSessionDomain;
                }
            }
        }
    };
}
