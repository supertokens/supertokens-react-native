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
import AuthHttpRequest from "./fetch";
import FrontToken from "./frontToken";
import { supported_fdi } from "./version";
import IdRefreshToken from "./idRefreshToken";
import { interceptorFunctionRequestFulfilled, responseErrorInterceptor, responseInterceptor } from "./axios";
export default class RecipeImplementation {
    constructor() {
        this.addFetchInterceptorsAndReturnModifiedFetch = (originalFetch, _) => {
            return (url, config) =>
                __awaiter(this, void 0, void 0, function*() {
                    return yield AuthHttpRequest.doRequest(
                        config => {
                            return originalFetch(url, Object.assign({}, config));
                        },
                        config,
                        url
                    );
                });
        };
        this.addAxiosInterceptors = (axiosInstance, _) => {
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
        };
        this.getUserId = config =>
            __awaiter(this, void 0, void 0, function*() {
                let tokenInfo = yield FrontToken.getTokenInfo();
                if (tokenInfo === undefined) {
                    throw new Error("No session exists");
                }
                return tokenInfo.uid;
            });
        this.getJWTPayloadSecurely = config =>
            __awaiter(this, void 0, void 0, function*() {
                let tokenInfo = yield FrontToken.getTokenInfo();
                if (tokenInfo === undefined) {
                    throw new Error("No session exists");
                }
                if (tokenInfo.ate < Date.now()) {
                    let retry = yield AuthHttpRequest.attemptRefreshingSession();
                    if (retry) {
                        return yield this.getJWTPayloadSecurely(config);
                    } else {
                        throw new Error("Could not refresh session");
                    }
                }
                return tokenInfo.up;
            });
        this.doesSessionExist = config =>
            __awaiter(this, void 0, void 0, function*() {
                return (yield IdRefreshToken.getIdRefreshToken(true)).status === "EXISTS";
            });
        this.signOut = config =>
            __awaiter(this, void 0, void 0, function*() {
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
                // we do not send an event here since it's triggered in setIdRefreshToken area.
            });
    }
}
