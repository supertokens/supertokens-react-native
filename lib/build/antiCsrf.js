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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocalSessionState } from "./utils";
const TOKEN_KEY = "supertokens-rn-anticsrf-key";
const ANTI_CSRF_NAME = "sAntiCsrf";
export default class AntiCSRF {
    constructor() {}
    static getAntiCSRFToken() {
        return __awaiter(this, void 0, void 0, function*() {
            if (!((yield getLocalSessionState()).status === "EXISTS")) {
                return null;
            }
            function getAntiCSRFFromStorage() {
                return __awaiter(this, void 0, void 0, function*() {
                    let fromStorage = yield AsyncStorage.getItem(TOKEN_KEY);
                    if (fromStorage !== null) {
                        let value = "; " + fromStorage;
                        let parts = value.split("; " + ANTI_CSRF_NAME + "=");
                        let last = parts.pop();
                        if (last !== undefined) {
                            let splitForExpiry = fromStorage.split(";");
                            let expiry = Date.parse(splitForExpiry[1].split("=")[1]);
                            let currentTime = Date.now();
                            if (expiry < currentTime) {
                                yield AntiCSRF.removeToken();
                                return null;
                            }
                            let temp = last.split(";").shift();
                            if (temp === undefined) {
                                return null;
                            }
                            return temp;
                        }
                    }
                    return null;
                });
            }
            let fromStorage = yield getAntiCSRFFromStorage();
            return fromStorage;
        });
    }
    static getToken(associatedAccessTokenUpdate) {
        return __awaiter(this, void 0, void 0, function*() {
            if (associatedAccessTokenUpdate === undefined) {
                AntiCSRF.tokenInfo = undefined;
                return undefined;
            }
            if (AntiCSRF.tokenInfo === undefined) {
                let antiCsrf = yield this.getAntiCSRFToken();
                if (antiCsrf === null) {
                    return undefined;
                }
                AntiCSRF.tokenInfo = {
                    antiCsrf,
                    associatedAccessTokenUpdate
                };
            } else if (AntiCSRF.tokenInfo.associatedAccessTokenUpdate !== associatedAccessTokenUpdate) {
                // csrf token has changed.
                AntiCSRF.tokenInfo = undefined;
                return yield AntiCSRF.getToken(associatedAccessTokenUpdate);
            }
            return AntiCSRF.tokenInfo.antiCsrf;
        });
    }
    // give antiCSRFToken as undefined to remove it.
    static setAntiCSRF(antiCSRFToken) {
        return __awaiter(this, void 0, void 0, function*() {
            function setAntiCSRFToStorage(antiCSRFToken, domain) {
                return __awaiter(this, void 0, void 0, function*() {
                    let expires = "Thu, 01 Jan 1970 00:00:01 GMT";
                    let cookieVal = "";
                    if (antiCSRFToken !== undefined) {
                        cookieVal = antiCSRFToken;
                        expires = undefined; // set cookie without expiry
                    }
                    let valueToSet = undefined;
                    if (expires !== undefined) {
                        valueToSet = `${ANTI_CSRF_NAME}=${cookieVal};expires=${expires};domain=${domain};path=/;samesite=lax`;
                    } else {
                        valueToSet = `${ANTI_CSRF_NAME}=${cookieVal};domain=${domain};expires=Fri, 31 Dec 9999 23:59:59 GMT;path=/;samesite=lax`;
                    }
                    yield AsyncStorage.setItem(TOKEN_KEY, valueToSet);
                });
            }
            yield setAntiCSRFToStorage(antiCSRFToken, "");
        });
    }
    static setItem(associatedAccessTokenUpdate, antiCsrf) {
        return __awaiter(this, void 0, void 0, function*() {
            if (associatedAccessTokenUpdate === undefined) {
                AntiCSRF.tokenInfo = undefined;
                return;
            }
            yield this.setAntiCSRF(antiCsrf);
            AntiCSRF.tokenInfo = {
                antiCsrf,
                associatedAccessTokenUpdate
            };
        });
    }
    static removeToken() {
        return __awaiter(this, void 0, void 0, function*() {
            AntiCSRF.tokenInfo = undefined;
            yield AsyncStorage.removeItem(TOKEN_KEY);
        });
    }
}
