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
import AsyncStorage from "@react-native-community/async-storage";
import AuthHttpRequest, { handleUnauthorised } from "./fetch";
const ID_KEY = "supertokens-rn-idrefreshtoken-key";
const ID_REFRESH_TOKEN_NAME = "sIRTFrontend";
export default class IdRefreshToken {
    // if tryRefresh is true & this token doesn't exist, we try and refresh the session
    // else we return undefined.
    static getIdRefreshToken(tryRefresh) {
        return __awaiter(this, void 0, void 0, function*() {
            function getIdRefreshFromStorage() {
                return __awaiter(this, void 0, void 0, function*() {
                    if (IdRefreshToken.idRefreshInMemory === undefined) {
                        let k = yield AsyncStorage.getItem(ID_KEY);
                        IdRefreshToken.idRefreshInMemory = k === null ? undefined : k;
                    }
                    if (IdRefreshToken.idRefreshInMemory !== undefined) {
                        let value = ";" + IdRefreshToken.idRefreshInMemory;
                        let parts = value.split(";" + ID_REFRESH_TOKEN_NAME + "=");
                        if (parts.length >= 2) {
                            let last = parts.pop();
                            if (last === "remove") {
                                // it means no session exists. This is different from
                                // it being undefined since in that case a session may or may not exist.
                                return "remove";
                            }
                            if (last !== undefined) {
                                return last.split(";").shift();
                            }
                        }
                        // Check for expiry
                        let splitForExpiry = IdRefreshToken.idRefreshInMemory.split(";");
                        let expiry = Date.parse(splitForExpiry[1].split("=")[1]);
                        let currentTime = Date.now();
                        if (expiry < currentTime) {
                            yield IdRefreshToken.removeToken();
                            // We return undefined here because the token has expired and we dont know if the user is logged out
                            // so a session may exist
                            return undefined;
                        }
                    }
                    return undefined;
                });
            }
            let token = yield getIdRefreshFromStorage();
            if (token === "remove") {
                return {
                    status: "NOT_EXISTS"
                };
            }
            if (token === undefined) {
                let response = {
                    status: "MAY_EXIST"
                };
                if (tryRefresh) {
                    // either session doesn't exist, or the
                    // cookies have expired (privacy feature that caps lifetime of cookies to 7 days)
                    try {
                        yield handleUnauthorised(response);
                    } catch (err) {
                        return {
                            status: "NOT_EXISTS"
                        };
                    }
                    return yield this.getIdRefreshToken(tryRefresh);
                } else {
                    return response;
                }
            }
            return {
                status: "EXISTS",
                token
            };
        });
    }
    static setIdRefreshToken(newIdRefreshToken, statusCode) {
        return __awaiter(this, void 0, void 0, function*() {
            function setIdToStorage(idRefreshToken, domain) {
                return __awaiter(this, void 0, void 0, function*() {
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
                    yield AsyncStorage.setItem(ID_KEY, valueToSet);
                    IdRefreshToken.idRefreshInMemory = valueToSet;
                });
            }
            const { status } = yield this.getIdRefreshToken(false);
            yield setIdToStorage(newIdRefreshToken, "");
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
        });
    }
    static removeToken() {
        return __awaiter(this, void 0, void 0, function*() {
            yield AsyncStorage.removeItem(ID_KEY);
            IdRefreshToken.idRefreshInMemory = undefined;
        });
    }
}
