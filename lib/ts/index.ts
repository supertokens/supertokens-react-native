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

import AuthHttpRequestFetch from "./fetch";
import { InputType, RecipeInterface } from "./types";
import { getTokenForHeaderAuth } from "./utils";

export default class AuthHttpRequest {
    private static axiosInterceptorQueue: (() => void)[] = [];

    static init(options: InputType) {
        AuthHttpRequestFetch.init(options);
        AuthHttpRequest.axiosInterceptorQueue.forEach(f => {
            f();
        });
        AuthHttpRequest.axiosInterceptorQueue = [];
    }

    static getUserId(): Promise<string> {
        if (!AuthHttpRequestFetch.initCalled) {
            throw Error("init function not called");
        }

        return AuthHttpRequestFetch.recipeImpl.getUserId(AuthHttpRequestFetch.config);
    }

    static async getAccessTokenPayloadSecurely(): Promise<any> {
        if (!AuthHttpRequestFetch.initCalled) {
            throw Error("init function not called");
        }

        return AuthHttpRequestFetch.recipeImpl.getAccessTokenPayloadSecurely(AuthHttpRequestFetch.config);
    }

    static attemptRefreshingSession = async (): Promise<boolean> => {
        return AuthHttpRequestFetch.attemptRefreshingSession();
    };

    static doesSessionExist = () => {
        if (!AuthHttpRequestFetch.initCalled) {
            throw Error("init function not called");
        }

        return AuthHttpRequestFetch.recipeImpl.doesSessionExist(AuthHttpRequestFetch.config);
    };

    static addAxiosInterceptors = (axiosInstance: any) => {
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

    static signOut = () => {
        if (!AuthHttpRequestFetch.initCalled) {
            throw Error("init function not called");
        }

        return AuthHttpRequestFetch.recipeImpl.signOut(AuthHttpRequestFetch.config);
    };

    static getAccessToken = async (): Promise<string | undefined> => {
        if (!AuthHttpRequestFetch.initCalled) {
            throw Error("init function not called");
        }

        // This takes care of refreshing the access token if needed
        if (await AuthHttpRequestFetch.recipeImpl.doesSessionExist(AuthHttpRequestFetch.config)) {
            return getTokenForHeaderAuth("access");
        }

        return undefined;
    };
}

export let init = AuthHttpRequest.init;
export let getUserId = AuthHttpRequest.getUserId;
export let getAccessTokenPayloadSecurely = AuthHttpRequest.getAccessTokenPayloadSecurely;
export let attemptRefreshingSession = AuthHttpRequest.attemptRefreshingSession;
export let doesSessionExist = AuthHttpRequest.doesSessionExist;
export let addAxiosInterceptors = AuthHttpRequest.addAxiosInterceptors;
export let signOut = AuthHttpRequest.signOut;
export let getAccessToken = AuthHttpRequest.getAccessToken;
export { RecipeInterface, InputType };
