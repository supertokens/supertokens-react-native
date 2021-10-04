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

import AsyncStorage from "@react-native-community/async-storage";
import AuthHttpRequest, { handleUnauthorised } from "./fetch";
import { IdRefreshTokenType } from "./types";

const ID_KEY = "supertokens-rn-idrefreshtoken-key";
const ID_REFRESH_TOKEN_NAME = "sIRTFrontend";

export default class IdRefreshToken {
    private static idRefreshInMemory: string | undefined;

    // if tryRefresh is true & this token doesn't exist, we try and refresh the session
    // else we return undefined.
    static async getIdRefreshToken(tryRefresh: boolean): Promise<IdRefreshTokenType> {
        if (IdRefreshToken.idRefreshInMemory === undefined) {
            let k = await AsyncStorage.getItem(ID_KEY);
            IdRefreshToken.idRefreshInMemory = k === null ? undefined : k;
        }

        if (IdRefreshToken.idRefreshInMemory !== undefined) {
            let splitted = IdRefreshToken.idRefreshInMemory.split(";");
            let expiry = Number(splitted[1]);
            let currentTime = Date.now();
            if (expiry < currentTime) {
                await IdRefreshToken.removeToken();
            }
        }

        let token = IdRefreshToken.idRefreshInMemory;

        if (token === "remove") {
            return {
                status: "NOT_EXISTS"
            };
        }

        if (token === undefined) {
            let response: IdRefreshTokenType = {
                status: "MAY_EXIST"
            };

            if (tryRefresh) {
                // either session doesn't exist, or the
                // cookies have expired (privacy feature that caps lifetime of cookies to 7 days)
                try {
                    await handleUnauthorised(response);
                } catch (err) {
                    return {
                        status: "NOT_EXISTS"
                    };
                }

                return await this.getIdRefreshToken(tryRefresh);
            } else {
                return response;
            }
        }

        return {
            status: "EXISTS",
            token
        };
    }

    static async setIdRefreshToken(newIdRefreshToken: string | "remove", statusCode: number) {
        async function setIdToStorage(idRefreshToken: string, domain: string) {
            // if the value of the token is "remove", it means
            // the session is being removed. So we set it to "remove" in the
            // cookie. This way, when we query for this token, we will return
            // undefined (see getIdRefreshToken), and not refresh the session
            // unnecessarily.

            let expires = "Fri, 31 Dec 9999 23:59:59 GMT";
            let cookieVal = "remove";
            if (idRefreshToken !== "remove") {
                let splitted = idRefreshToken.split(";");
                cookieVal = splitted[0];

                // we must always respect this expiry and not set it to infinite
                // cause this ties into the session's lifetime. If we set this
                // to infinite, then a session may not exist, and this will exist,
                // then for example, if we check a session exists, and this says yes,
                // then if we getJWTPayload, that will attempt a session refresh which will fail.
                // Another reason to respect this is that if we don't, then signOut will
                // call the API which will return 200 (no 401 cause the API thinks no session exists),
                // in which case, we will not end up firing the SIGN_OUT on handle event.
                expires = new Date(Number(splitted[1])).toUTCString();
            }

            let valueToSet = `${ID_REFRESH_TOKEN_NAME}=${cookieVal};expires=${expires};domain=${domain};path=/;samesite=lax`;
            await AsyncStorage.setItem(ID_KEY, valueToSet);
            IdRefreshToken.idRefreshInMemory = valueToSet;
        }

        const { status } = await this.getIdRefreshToken(false);
        await setIdToStorage(newIdRefreshToken, "");

        if (newIdRefreshToken === "remove" && status === "EXISTS") {
            // we check for wasLoggedIn cause we don't want to fire an event
            // unnecessarily on first app load or if the user tried
            // to query an API that returned 401 while the user was not logged in...
            if (statusCode === AuthHttpRequest.config.sessionExpiredStatusCode) {
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

        if (newIdRefreshToken !== "remove" && status === "NOT_EXISTS") {
            AuthHttpRequest.config.onHandleEvent({
                action: "SESSION_CREATED"
            });
        }
    }

    static async removeToken() {
        await AsyncStorage.removeItem(ID_KEY);
        IdRefreshToken.idRefreshInMemory = undefined;
    }
}
