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
import { createAxiosErrorFromAxiosResp, createAxiosErrorFromFetchResp } from "./axiosError";
import AuthHttpRequestFetch, { onUnauthorisedResponse } from "./fetch";
import FrontToken from "./frontToken";
import AntiCSRF from "./antiCsrf";
import { PROCESS_STATE, ProcessState } from "./processState";
import { getLocalSessionState, shouldDoInterceptionBasedOnUrl } from "./utils";
function getUrlFromConfig(config) {
    let url = config.url === undefined ? "" : config.url;
    let baseURL = config.baseURL;
    if (baseURL !== undefined) {
        if (url.charAt(0) === "/" && baseURL.charAt(baseURL.length - 1) === "/") {
            url = baseURL + url.substr(1);
        } else if (url.charAt(0) !== "/" && baseURL.charAt(baseURL.length - 1) !== "/") {
            url = baseURL + "/" + url;
        } else {
            url = baseURL + url;
        }
    }
    return url;
}
export function interceptorFunctionRequestFulfilled(config) {
    return __awaiter(this, void 0, void 0, function*() {
        let url = getUrlFromConfig(config);
        let doNotDoInterception = false;
        try {
            doNotDoInterception =
                typeof url === "string" &&
                !shouldDoInterceptionBasedOnUrl(
                    url,
                    AuthHttpRequestFetch.config.apiDomain,
                    AuthHttpRequestFetch.config.sessionTokenBackendDomain
                );
        } catch (err) {
            // This is because when this function is called we always have a full URL (refer to getUrlFromConfig),
            // so we do not need to check for the case where axios is called with just a path (for example axios.post("/login"))
            throw err;
        }
        if (doNotDoInterception) {
            // this check means that if you are using axios via inteceptor, then we only do the refresh steps if you are calling your APIs.
            return config;
        }
        ProcessState.getInstance().addState(PROCESS_STATE.CALLING_INTERCEPTION_REQUEST);
        const preRequestIdToken = yield getLocalSessionState();
        let configWithAntiCsrf = config;
        if (preRequestIdToken.status === "EXISTS") {
            const antiCsrfToken = yield AntiCSRF.getToken(preRequestIdToken.lastAccessTokenUpdate);
            if (antiCsrfToken !== undefined) {
                configWithAntiCsrf = Object.assign(Object.assign({}, configWithAntiCsrf), {
                    headers:
                        configWithAntiCsrf === undefined
                            ? {
                                  "anti-csrf": antiCsrfToken
                              }
                            : Object.assign(Object.assign({}, configWithAntiCsrf.headers), {
                                  "anti-csrf": antiCsrfToken
                              })
                });
            }
        }
        if (AuthHttpRequestFetch.config.autoAddCredentials && configWithAntiCsrf.withCredentials === undefined) {
            configWithAntiCsrf = Object.assign(Object.assign({}, configWithAntiCsrf), { withCredentials: true });
        }
        // adding rid for anti-csrf protection: Anti-csrf via custom header
        configWithAntiCsrf = Object.assign(Object.assign({}, configWithAntiCsrf), {
            headers:
                configWithAntiCsrf === undefined
                    ? {
                          rid: "anti-csrf"
                      }
                    : Object.assign({ rid: "anti-csrf" }, configWithAntiCsrf.headers)
        });
        return configWithAntiCsrf;
    });
}
export function responseInterceptor(axiosInstance) {
    return response =>
        __awaiter(this, void 0, void 0, function*() {
            let doNotDoInterception = false;
            try {
                if (!AuthHttpRequestFetch.initCalled) {
                    throw new Error("init function not called");
                }
                let url = getUrlFromConfig(response.config);
                try {
                    doNotDoInterception =
                        typeof url === "string" &&
                        !shouldDoInterceptionBasedOnUrl(
                            url,
                            AuthHttpRequestFetch.config.apiDomain,
                            AuthHttpRequestFetch.config.sessionTokenBackendDomain
                        );
                } catch (err) {
                    // This is because when this function is called we always have a full URL (refer to getUrlFromConfig),
                    // so we do not need to check for the case where axios is called with just a path (for example axios.post("/login"))
                    throw err;
                }
                if (doNotDoInterception) {
                    // this check means that if you are using axios via inteceptor, then we only do the refresh steps if you are calling your APIs.
                    return response;
                }
                ProcessState.getInstance().addState(PROCESS_STATE.CALLING_INTERCEPTION_RESPONSE);
                let idRefreshToken = response.headers["id-refresh-token"];
                if (idRefreshToken !== undefined) {
                    // await LocalSessionState.setLocalSessionState(idRefreshToken, response.status);
                }
                if (response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode) {
                    let config = response.config;
                    return AuthHttpRequest.doRequest(
                        config => {
                            // we create an instance since we don't want to intercept this.
                            // const instance = axios.create();
                            // return instance(config);
                            return axiosInstance(config);
                        },
                        config,
                        url,
                        response,
                        true
                    );
                } else {
                    let antiCsrfToken = response.headers["anti-csrf"];
                    if (antiCsrfToken !== undefined) {
                        let tok = yield getLocalSessionState();
                        if (tok.status === "EXISTS") {
                            yield AntiCSRF.setItem(tok.lastAccessTokenUpdate, antiCsrfToken);
                        }
                    }
                    let frontToken = response.headers["front-token"];
                    if (frontToken !== undefined) {
                        yield FrontToken.setItem(frontToken);
                    }
                    return response;
                }
            } finally {
                if (
                    !doNotDoInterception &&
                    !(yield AuthHttpRequestFetch.recipeImpl.doesSessionExist(AuthHttpRequestFetch.config))
                ) {
                    yield AntiCSRF.removeToken();
                    yield FrontToken.removeToken();
                }
            }
        });
}
export function responseErrorInterceptor(axiosInstance) {
    return error => {
        if (
            error.response !== undefined &&
            error.response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode
        ) {
            let config = error.config;
            return AuthHttpRequest.doRequest(
                config => {
                    // we create an instance since we don't want to intercept this.
                    // const instance = axios.create();
                    // return instance(config);
                    return axiosInstance(config);
                },
                config,
                getUrlFromConfig(config),
                undefined,
                error,
                true
            );
        } else {
            throw error;
        }
    };
}
/**
 * @class AuthHttpRequest
 * @description wrapper for common http methods.
 */
export default class AuthHttpRequest {}
/**
 * @description sends the actual http request and returns a response if successful/
 * If not successful due to session expiry reasons, it
 * attempts to call the refresh token API and if that is successful, calls this API again.
 * @throws Error
 */
AuthHttpRequest.doRequest = (httpCall, config, url, prevResponse, prevError, viaInterceptor = false) =>
    __awaiter(void 0, void 0, void 0, function*() {
        if (!AuthHttpRequestFetch.initCalled) {
            throw Error("init function not called");
        }
        let doNotDoInterception = false;
        try {
            doNotDoInterception =
                typeof url === "string" &&
                !shouldDoInterceptionBasedOnUrl(
                    url,
                    AuthHttpRequestFetch.config.apiDomain,
                    AuthHttpRequestFetch.config.sessionTokenBackendDomain
                ) &&
                viaInterceptor;
        } catch (err) {
            // This is because when this function is called we always have a full URL (refer to getUrlFromConfig),
            // so we do not need to check for the case where axios is called with just a path (for example axios.post("/login"))
            throw err;
        }
        if (doNotDoInterception) {
            if (prevError !== undefined) {
                throw prevError;
            } else if (prevResponse !== undefined) {
                return prevResponse;
            }
            return yield httpCall(config);
        }
        try {
            let returnObj = undefined;
            while (true) {
                // we read this here so that if there is a session expiry error, then we can compare this value (that caused the error) with the value after the request is sent.
                // to avoid race conditions
                const preRequestIdToken = yield getLocalSessionState();
                let configWithAntiCsrf = config;
                if (preRequestIdToken.status === "EXISTS") {
                    const antiCsrfToken = yield AntiCSRF.getToken(preRequestIdToken.lastAccessTokenUpdate);
                    if (antiCsrfToken !== undefined) {
                        configWithAntiCsrf = Object.assign(Object.assign({}, configWithAntiCsrf), {
                            headers:
                                configWithAntiCsrf === undefined
                                    ? {
                                          "anti-csrf": antiCsrfToken
                                      }
                                    : Object.assign(Object.assign({}, configWithAntiCsrf.headers), {
                                          "anti-csrf": antiCsrfToken
                                      })
                        });
                    }
                }
                if (
                    AuthHttpRequestFetch.config.autoAddCredentials &&
                    configWithAntiCsrf.withCredentials === undefined
                ) {
                    configWithAntiCsrf = Object.assign(Object.assign({}, configWithAntiCsrf), {
                        withCredentials: true
                    });
                }
                // adding rid for anti-csrf protection: Anti-csrf via custom header
                configWithAntiCsrf = Object.assign(Object.assign({}, configWithAntiCsrf), {
                    headers:
                        configWithAntiCsrf === undefined
                            ? {
                                  rid: "anti-csrf"
                              }
                            : Object.assign({ rid: "anti-csrf" }, configWithAntiCsrf.headers)
                });
                try {
                    let localPrevError = prevError;
                    let localPrevResponse = prevResponse;
                    prevError = undefined;
                    prevResponse = undefined;
                    if (localPrevError !== undefined) {
                        throw localPrevError;
                    }
                    let response =
                        localPrevResponse === undefined ? yield httpCall(configWithAntiCsrf) : localPrevResponse;
                    let idRefreshToken = response.headers["id-refresh-token"];
                    if (idRefreshToken !== undefined) {
                        // await LocalSessionState.setLocalSessionState(idRefreshToken, response.status);
                    }
                    if (response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode) {
                        const refreshResult = yield onUnauthorisedResponse(preRequestIdToken);
                        if (refreshResult.result !== "RETRY") {
                            returnObj = refreshResult.error
                                ? yield createAxiosErrorFromFetchResp(refreshResult.error)
                                : yield createAxiosErrorFromAxiosResp(response);
                            break;
                        }
                    } else {
                        let antiCsrfToken = response.headers["anti-csrf"];
                        if (antiCsrfToken !== undefined) {
                            let tok = yield getLocalSessionState();
                            if (tok.status === "EXISTS") {
                                yield AntiCSRF.setItem(tok.lastAccessTokenUpdate, antiCsrfToken);
                            }
                        }
                        let frontToken = response.headers["front-token"];
                        if (frontToken !== undefined) {
                            yield FrontToken.setItem(frontToken);
                        }
                        return response;
                    }
                } catch (err) {
                    if (err.response !== undefined) {
                        let idRefreshToken = err.response.headers["id-refresh-token"];
                        if (idRefreshToken !== undefined) {
                            // await LocalSessionState.setLocalSessionState(idRefreshToken, err.response.status);
                        }
                        if (err.response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode) {
                            const refreshResult = yield onUnauthorisedResponse(preRequestIdToken);
                            if (refreshResult.result !== "RETRY") {
                                // Returning refreshResult.error as an Axios Error if we attempted a refresh
                                // Returning the original error if we did not attempt refreshing
                                returnObj =
                                    refreshResult.error !== undefined
                                        ? yield createAxiosErrorFromFetchResp(refreshResult.error)
                                        : err;
                                break;
                            }
                        } else {
                            throw err;
                        }
                    } else {
                        throw err;
                    }
                }
            }
            // if it comes here, means we called break. which happens only if we have logged out.
            // which means it's a 401, so we throw
            throw returnObj;
        } finally {
            // If we get here we already tried refreshing so we should have the already id refresh token either in EXISTS or NOT_EXISTS, so no need to call the backend
            // The backend should not be down if we get here, but even if it were we shouldn't need to call refresh
            const postRequestIdToken = yield getLocalSessionState();
            if (postRequestIdToken.status === "NOT_EXISTS") {
                yield AntiCSRF.removeToken();
                yield FrontToken.removeToken();
            }
        }
    });
