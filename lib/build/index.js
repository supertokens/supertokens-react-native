/* Copyright (c) 2020, VRAI Labs and/or its affiliates. All rights reserved.
 *
 * This software is licensed under the Apache License, Version 2.0 (the
 * "License") as published by the Apache Software Foundation.
 *
 * You may not use this file except in compliance with the License. You may
 * obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */
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
var _a;
import AuthHttpRequestFetch from "./fetch";
import { getTokenForHeaderAuth } from "./utils";
class AuthHttpRequest {
    static init(options) {
        AuthHttpRequestFetch.init(options);
        _a.axiosInterceptorQueue.forEach(f => {
            f();
        });
        _a.axiosInterceptorQueue = [];
    }
    static getUserId() {
        if (!AuthHttpRequestFetch.initCalled) {
            throw Error("init function not called");
        }
        return AuthHttpRequestFetch.recipeImpl.getUserId(AuthHttpRequestFetch.config);
    }
    static getAccessTokenPayloadSecurely() {
        return __awaiter(this, void 0, void 0, function*() {
            if (!AuthHttpRequestFetch.initCalled) {
                throw Error("init function not called");
            }
            return AuthHttpRequestFetch.recipeImpl.getAccessTokenPayloadSecurely(AuthHttpRequestFetch.config);
        });
    }
}
_a = AuthHttpRequest;
AuthHttpRequest.axiosInterceptorQueue = [];
AuthHttpRequest.attemptRefreshingSession = () =>
    __awaiter(void 0, void 0, void 0, function*() {
        return AuthHttpRequestFetch.attemptRefreshingSession();
    });
AuthHttpRequest.doesSessionExist = () => {
    if (!AuthHttpRequestFetch.initCalled) {
        throw Error("init function not called");
    }
    return AuthHttpRequestFetch.recipeImpl.doesSessionExist(AuthHttpRequestFetch.config);
};
AuthHttpRequest.addAxiosInterceptors = axiosInstance => {
    if (!AuthHttpRequestFetch.initCalled) {
        // the recipe implementation has not been initialised yet, so add
        // this to the queue and wait for it to be initialised, and then on
        // init call, we add all the interceptors.
        _a.axiosInterceptorQueue.push(() => {
            AuthHttpRequestFetch.recipeImpl.addAxiosInterceptors(axiosInstance, AuthHttpRequestFetch.config);
        });
    } else {
        AuthHttpRequestFetch.recipeImpl.addAxiosInterceptors(axiosInstance, AuthHttpRequestFetch.config);
    }
};
AuthHttpRequest.signOut = () => {
    if (!AuthHttpRequestFetch.initCalled) {
        throw Error("init function not called");
    }
    return AuthHttpRequestFetch.recipeImpl.signOut(AuthHttpRequestFetch.config);
};
AuthHttpRequest.getAccessToken = () =>
    __awaiter(void 0, void 0, void 0, function*() {
        if (!AuthHttpRequestFetch.initCalled) {
            throw Error("init function not called");
        }
        // This takes care of refreshing the access token if needed
        if (yield AuthHttpRequestFetch.recipeImpl.doesSessionExist(AuthHttpRequestFetch.config)) {
            return getTokenForHeaderAuth("access");
        }
        return undefined;
    });
export default AuthHttpRequest;
export let init = AuthHttpRequest.init;
export let getUserId = AuthHttpRequest.getUserId;
export let getAccessTokenPayloadSecurely = AuthHttpRequest.getAccessTokenPayloadSecurely;
export let attemptRefreshingSession = AuthHttpRequest.attemptRefreshingSession;
export let doesSessionExist = AuthHttpRequest.doesSessionExist;
export let addAxiosInterceptors = AuthHttpRequest.addAxiosInterceptors;
export let signOut = AuthHttpRequest.signOut;
export let getAccessToken = AuthHttpRequest.getAccessToken;
