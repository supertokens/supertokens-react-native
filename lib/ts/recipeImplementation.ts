import { RecipeInterface, NormalisedInputType } from "./types";
import AuthHttpRequest from "./fetch";
import FrontToken from "./frontToken";
import { supported_fdi } from "./version";
import IdRefreshToken from "./idRefreshToken";
import { interceptorFunctionRequestFulfilled, responseErrorInterceptor, responseInterceptor } from "./axios";

export default class RecipeImplementation implements RecipeInterface {
    addFetchInterceptorsAndReturnModifiedFetch = (originalFetch: any, _: NormalisedInputType): typeof fetch => {
        return async (url: RequestInfo, config?: RequestInit): Promise<Response> => {
            return await AuthHttpRequest.doRequest(
                (config?: RequestInit) => {
                    return originalFetch(url, {
                        ...config
                    });
                },
                config,
                url
            );
        };
    };

    addAxiosInterceptors = (axiosInstance: any, _: NormalisedInputType): void => {
        // we first check if this axiosInstance already has our interceptors.
        let requestInterceptors = axiosInstance.interceptors.request;
        for (let i = 0; i < requestInterceptors.handlers.length; i++) {
            if (requestInterceptors.handlers[i].fulfilled === interceptorFunctionRequestFulfilled) {
                return;
            }
        }
        // Add a request interceptor
        axiosInstance.interceptors.request.use(interceptorFunctionRequestFulfilled, async function(error: any) {
            throw error;
        });

        // Add a response interceptor
        axiosInstance.interceptors.response.use(
            responseInterceptor(axiosInstance),
            responseErrorInterceptor(axiosInstance)
        );
    };

    getUserId = async (config: NormalisedInputType): Promise<string> => {
        let tokenInfo = await FrontToken.getTokenInfo();
        if (tokenInfo === undefined) {
            throw new Error("No session exists");
        }
        return tokenInfo.uid;
    };

    getAccessTokenPayloadSecurely = async (config: NormalisedInputType): Promise<any> => {
        let tokenInfo = await FrontToken.getTokenInfo();
        if (tokenInfo === undefined) {
            throw new Error("No session exists");
        }

        if (tokenInfo.ate < Date.now()) {
            let retry = await AuthHttpRequest.attemptRefreshingSession();
            if (retry) {
                return await this.getAccessTokenPayloadSecurely(config);
            } else {
                throw new Error("Could not refresh session");
            }
        }
        return tokenInfo.up;
    };

    doesSessionExist = async (config: NormalisedInputType): Promise<boolean> => {
        return (await IdRefreshToken.getIdRefreshToken(true)).status === "EXISTS";
    };

    signOut = async (config: NormalisedInputType): Promise<void> => {
        if (!(await this.doesSessionExist(config))) {
            config.onHandleEvent({
                action: "SIGN_OUT"
            });
            return;
        }

        let preAPIResult = await config.preAPIHook({
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

        let resp = await fetch(preAPIResult.url, preAPIResult.requestInit);

        if (resp.status === config.sessionExpiredStatusCode) {
            // refresh must have already sent session expiry event
            return;
        }

        if (resp.status >= 300) {
            throw resp;
        }

        // we do not send an event here since it's triggered in setIdRefreshToken area.
    };
}
