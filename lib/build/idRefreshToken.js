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
import { AsyncStorage } from "react-native";
// TODO: if native is linked, do not use in memory values - always make a call to native.
// This is because there is a chance that native side has changed the id refresh token, and here, we are still using the older one.
// Or is this OK?
const ID_KEY = "supertokens-rn-idrefreshtoken-key";
export default class IdRefreshToken {
    static getToken() {
        return __awaiter(this, void 0, void 0, function*() {
            if (IdRefreshToken.idRefreshInMemory === undefined) {
                // TODO: native support
                let k = yield AsyncStorage.getItem(ID_KEY);
                IdRefreshToken.idRefreshInMemory = k === null ? undefined : k;
            }
            if (IdRefreshToken.idRefreshInMemory !== undefined) {
                let splitted = IdRefreshToken.idRefreshInMemory.split(";");
                let expiry = Number(splitted[1]);
                let currentTime = Date.now();
                if (expiry < currentTime) {
                    yield IdRefreshToken.removeToken();
                }
            }
            return IdRefreshToken.idRefreshInMemory;
        });
    }
    static setToken(newIdRefreshToken) {
        return __awaiter(this, void 0, void 0, function*() {
            if (newIdRefreshToken === "remove") {
                yield IdRefreshToken.removeToken();
                return;
            }
            let splitted = newIdRefreshToken.split(";");
            let expiry = Number(splitted[1]);
            let currentTime = Date.now();
            if (expiry < currentTime) {
                yield IdRefreshToken.removeToken();
            } else {
                // TODO: set in native side when that support is there
                yield AsyncStorage.setItem(ID_KEY, newIdRefreshToken);
                IdRefreshToken.idRefreshInMemory = newIdRefreshToken;
            }
        });
    }
    static removeToken() {
        return __awaiter(this, void 0, void 0, function*() {
            // TODO: set in native
            yield AsyncStorage.removeItem(ID_KEY);
            IdRefreshToken.idRefreshInMemory = undefined;
        });
    }
}
