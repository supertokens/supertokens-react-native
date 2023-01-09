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

import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthHttpRequest from "./fetch";
import { getLocalSessionState } from "./utils";

const TOKEN_KEY = "supertokens-rn-anticsrf-key";
const ANTI_CSRF_NAME = "sAntiCsrf";

export default class AntiCSRF {
    private static tokenInfo:
        | undefined
        | {
              antiCsrf: string;
              associatedAccessTokenUpdate: string;
          };

    private constructor() {}

    private static async getAntiCSRFToken(): Promise<string | null> {
        if (!((await getLocalSessionState()).status === "EXISTS")) {
            return null;
        }

        async function getAntiCSRFFromStorage(): Promise<string | null> {
            let fromStorage = await AsyncStorage.getItem(TOKEN_KEY);

            if (fromStorage !== null) {
                return fromStorage;
            }

            return null;
        }

        let fromStorage = await getAntiCSRFFromStorage();
        return fromStorage;
    }

    static async getToken(associatedAccessTokenUpdate: string | undefined): Promise<string | undefined> {
        if (associatedAccessTokenUpdate === undefined) {
            AntiCSRF.tokenInfo = undefined;
            return undefined;
        }

        if (AntiCSRF.tokenInfo === undefined) {
            let antiCsrf = await this.getAntiCSRFToken();

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
            return await AntiCSRF.getToken(associatedAccessTokenUpdate);
        }
        return AntiCSRF.tokenInfo.antiCsrf;
    }

    // give antiCSRFToken as undefined to remove it.
    private static async setAntiCSRF(antiCSRFToken: string | undefined) {
        async function setAntiCSRFToStorage(antiCSRFToken: string | undefined) {
            if (antiCSRFToken === undefined) {
                await AntiCSRF.removeToken();
            } else {
                await AsyncStorage.setItem(TOKEN_KEY, antiCSRFToken);
            }
        }

        await setAntiCSRFToStorage(antiCSRFToken);
    }

    static async setItem(associatedAccessTokenUpdate: string | undefined, antiCsrf: string) {
        if (associatedAccessTokenUpdate === undefined) {
            AntiCSRF.tokenInfo = undefined;
            return;
        }

        await this.setAntiCSRF(antiCsrf);
        AntiCSRF.tokenInfo = {
            antiCsrf,
            associatedAccessTokenUpdate
        };
    }

    static async removeToken() {
        AntiCSRF.tokenInfo = undefined;
        await AsyncStorage.removeItem(TOKEN_KEY);
    }
}
