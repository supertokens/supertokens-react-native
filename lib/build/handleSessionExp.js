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
import AuthHttpRequest from "./";
import { package_version } from "./version";
import AntiCSRF from "./antiCsrf";
import IdRefreshToken from "./idRefreshToken";
import getLock from "./locking";
const LOCK_NAME = "REFRESH_TOKEN_USE";
export function onUnauthorisedResponse(
    refreshTokenUrl,
    preRequestIdToken,
    refreshAPICustomHeaders,
    sessionExpiredStatusCode
) {
    return __awaiter(this, void 0, void 0, function*() {
        let lock = getLock();
        // TODO: lock natively
        yield lock.lock(LOCK_NAME);
        try {
            let postLockID = yield IdRefreshToken.getToken();
            if (postLockID === undefined) {
                return { result: "SESSION_EXPIRED" };
            }
            if (postLockID !== preRequestIdToken) {
                // means that some other process has already called this API and succeeded. so we need to call it again
                return { result: "RETRY" };
            }
            let response = yield AuthHttpRequest.originalFetch(refreshTokenUrl, {
                method: "post",
                credentials: "include",
                headers: Object.assign({}, refreshAPICustomHeaders, {
                    "supertokens-sdk-name": "website",
                    "supertokens-sdk-version": package_version
                })
            });
            let removeIdRefreshToken = true;
            response.headers.forEach((value, key) =>
                __awaiter(this, void 0, void 0, function*() {
                    if (key.toString() === "id-refresh-token") {
                        yield IdRefreshToken.setToken(value);
                        removeIdRefreshToken = false;
                    }
                })
            );
            if (response.status === sessionExpiredStatusCode) {
                // there is a case where frontend still has id refresh token, but backend doesn't get it. In this event, session expired error will be thrown and the frontend should remove this token
                if (removeIdRefreshToken) {
                    yield IdRefreshToken.setToken("remove");
                }
            }
            if (response.status !== 200) {
                throw response;
            }
            if ((yield IdRefreshToken.getToken()) === undefined) {
                // removed by server. So we logout
                return { result: "SESSION_EXPIRED" };
            }
            response.headers.forEach((value, key) =>
                __awaiter(this, void 0, void 0, function*() {
                    if (key.toString() === "anti-csrf") {
                        yield AntiCSRF.setToken(value, yield IdRefreshToken.getToken());
                    }
                })
            );
            return { result: "RETRY" };
        } catch (error) {
            if ((yield IdRefreshToken.getToken()) === undefined) {
                // removed by server.
                return { result: "SESSION_EXPIRED" };
            }
            return { result: "API_ERROR", error };
        } finally {
            // TODO: unlock natively
            lock.unlock(LOCK_NAME);
        }
    });
}
