/* Copyright (c) 2022, VRAI Labs and/or its affiliates. All rights reserved.
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
import { spawn } from "child_process";
import { ProcessState, PROCESS_STATE } from "supertokens-react-native/lib/build/processState";
const axiosCookieJarSupport = require("axios-cookiejar-support").default;
import "isomorphic-fetch";
// jest does not call setupFiles properly with the new react-native init, so doing it this way instead
import "./setup";
import AntiCsrfToken from "supertokens-react-native/lib/build/antiCsrf";
import IdRefreshToken from "supertokens-react-native/lib/build/idRefreshToken";
import FrontToken from "supertokens-react-native/lib/build/frontToken";
import AuthHttpRequestFetch from "supertokens-react-native/lib/build/fetch";
import AuthHttpRequest from "supertokens-react-native";
import assert from "assert";
import axios from "axios";
const tough = require("tough-cookie");
import {
    startST,
    BASE_URL_FOR_ST,
} from "./utils";
import {SuperTokensGeneralError} from "supertokens-react-native/utils/error";

const BASE_URL = "http://localhost:8080";

process.env.TEST_MODE = "testing";

describe("Test general errors when calling sign out", function () {
    function assertEqual(a, b) {
        assert(a === b);
    }

    function assertNotEqual(a, b) {
        if (a === b) {
            throw new Error("assert failed");
        }
    }

    describe("Fetch tests", function () {
        beforeAll(async function() {
            spawn("./test/startServer", [
                process.env.INSTALL_PATH,
                process.env.NODE_PORT === undefined ? 8080 : process.env.NODE_PORT
            ]);
            await new Promise(r => setTimeout(r, 1000));
        });
    
        afterAll(async function() {
            let instance = axios.create();
            await instance.post(BASE_URL_FOR_ST + "/after");
            try {
                await instance.get(BASE_URL_FOR_ST + "/stop");
            } catch (err) {}
        });

        beforeEach(async function() {
            AuthHttpRequestFetch.initCalled = false;
            ProcessState.getInstance().reset();
            // reset all tokens
            await IdRefreshToken.removeToken();
            await AntiCsrfToken.removeToken();
            await FrontToken.removeToken();
    
            let instance = axios.create();
            await instance.post(BASE_URL_FOR_ST + "/beforeeach");
            await instance.post(BASE_URL + "/beforeeach");
    
            let nodeFetch = require("node-fetch").default;
            const fetch = require("fetch-cookie")(nodeFetch, new tough.CookieJar());
            global.fetch = fetch;
            global.__supertokensOriginalFetch = undefined;
            global.__supertokensSessionRecipe = undefined;
        });

        it("Test that getting GENERAL_ERROR from signout throws an error", async function (done) {
            try {
                jest.setTimeout(10000);
                await startST();

                AuthHttpRequest.init({
                    apiDomain: BASE_URL,
                    preAPIHook: (ctx) => {
                        if (ctx.action === "SIGN_OUT") {
                            let requestBody = ctx.requestInit.body === undefined ? "{}" : ctx.requestInit.body;
                            let jsonBody = JSON.parse(requestBody);
                            jsonBody = {
                                ...jsonBody,
                                generalError: true,
                            };

                            ctx.requestInit.headers["Content-Type"] = "application/json";
                            ctx.requestInit.body = JSON.stringify(jsonBody);
                        }

                        return ctx;
                    },
                });

                let userId = "testing-supertokens-react-native";

                //send loing request
                let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                    method: "post",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ userId })
                });
                
                assertEqual(await loginResponse.text(), userId);

                await AuthHttpRequest.signOut();

                assertEqual(await AuthHttpRequest.doesSessionExist(), false);

                done();
            } catch (e) {
                if (e.isSuperTokensGeneralError === true && e.message === "general error from signout API") {
                    done()
                } else {
                    done(e);   
                }
            }
        });
    });

    describe("axios tests", function () {
        let axiosInstance;

        beforeAll(async function() {
            spawn("./test/startServer", [
                process.env.INSTALL_PATH,
                process.env.NODE_PORT === undefined ? 8080 : process.env.NODE_PORT
            ]);
            await new Promise(r => setTimeout(r, 1000));
        });
    
        afterAll(async function() {
            let instance = axios.create();
            await instance.post(BASE_URL_FOR_ST + "/after");
            try {
                await instance.get(BASE_URL_FOR_ST + "/stop");
            } catch (err) {}
        });
    
        beforeEach(async function() {
            AuthHttpRequestFetch.initCalled = false;
            ProcessState.getInstance().reset();
            // reset all tokens
            await IdRefreshToken.removeToken();
            await AntiCsrfToken.removeToken();
            await FrontToken.removeToken();
    
            let instance = axios.create();
            await instance.post(BASE_URL_FOR_ST + "/beforeeach");
            await instance.post(BASE_URL + "/beforeeach");
    
            let cookieJar = new tough.CookieJar();
            axiosInstance = axios.create({
                withCredentials: true
            });
            axiosCookieJarSupport(axiosInstance);
            axiosInstance.defaults.jar = cookieJar;
    
            let nodeFetch = require("node-fetch").default;
            const fetch = require("fetch-cookie")(nodeFetch, cookieJar);
            global.fetch = fetch;
            global.__supertokensOriginalFetch = undefined;
            global.__supertokensSessionRecipe = undefined;
        });

        it("Test that getting GENERAL_ERROR from signout throws an error", async function () {
            let testPassed = false;
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);

            AuthHttpRequest.init({
                apiDomain: BASE_URL,
                preAPIHook: (ctx) => {
                    if (ctx.action === "SIGN_OUT") {
                        let requestBody = ctx.requestInit.body === undefined ? "{}" : ctx.requestInit.body;
                        let jsonBody = JSON.parse(requestBody);
                        jsonBody = {
                            ...jsonBody,
                            generalError: true,
                        };

                        ctx.requestInit.headers["Content-Type"] = "application/json";
                        ctx.requestInit.body = JSON.stringify(jsonBody);
                    }

                    return ctx;
                },
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            assertEqual(userId, loginResponse.data);

            try {
                await AuthHttpRequest.signOut();
            } catch (e) {
                if (e.isSuperTokensGeneralError === true && e.message === "general error from signout API") {
                    testPassed = true;
                }
            }

            assertEqual(testPassed, true);
        })
    })
});
