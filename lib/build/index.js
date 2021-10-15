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
                result.done
                    ? resolve(result.value)
                    : new P(function(resolve) {
                          resolve(result.value);
                      }).then(fulfilled, rejected);
            }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
import AuthHttpRequestFetch from "./fetch";
import "react-native-url-polyfill/auto";
export default class AuthHttpRequest {
    static init(options) {
        AuthHttpRequestFetch.init(options);
        AuthHttpRequest.axiosInterceptorQueue.forEach(f => {
            f();
        });
        AuthHttpRequest.axiosInterceptorQueue = [];
    }
    static getUserId() {
        return AuthHttpRequestFetch.recipeImpl.getUserId(AuthHttpRequestFetch.config);
    }
    static getJWTPayloadSecurely() {
        return __awaiter(this, void 0, void 0, function*() {
            return AuthHttpRequestFetch.recipeImpl.getJWTPayloadSecurely(AuthHttpRequestFetch.config);
        });
    }
}
AuthHttpRequest.axiosInterceptorQueue = [];
AuthHttpRequest.attemptRefreshingSession = () =>
    __awaiter(this, void 0, void 0, function*() {
        return AuthHttpRequestFetch.attemptRefreshingSession();
    });
AuthHttpRequest.doesSessionExist = () => {
    return AuthHttpRequestFetch.recipeImpl.doesSessionExist(AuthHttpRequestFetch.config);
};
AuthHttpRequest.addAxiosInterceptors = axiosInstance => {
    if (!AuthHttpRequestFetch.initCalled) {
        // the recipe implementation has not been initialised yet, so add
        // this to the queue and wait for it to be initialised, and then on
        // init call, we add all the interceptors.
        AuthHttpRequest.axiosInterceptorQueue.push(() => {
            AuthHttpRequestFetch.recipeImpl.addAxiosInterceptors(axiosInstance, AuthHttpRequestFetch.config);
        });
    } else {
        AuthHttpRequestFetch.recipeImpl.addAxiosInterceptors(axiosInstance, AuthHttpRequestFetch.config);
    }
};
AuthHttpRequest.signOut = () => {
    return AuthHttpRequestFetch.recipeImpl.signOut(AuthHttpRequestFetch.config);
};
export let init = AuthHttpRequest.init;
export let getUserId = AuthHttpRequest.getUserId;
export let getJWTPayloadSecurely = AuthHttpRequest.getJWTPayloadSecurely;
export let attemptRefreshingSession = AuthHttpRequest.attemptRefreshingSession;
export let doesSessionExist = AuthHttpRequest.doesSessionExist;
export let addAxiosInterceptors = AuthHttpRequest.addAxiosInterceptors;
export let signOut = AuthHttpRequest.signOut;
