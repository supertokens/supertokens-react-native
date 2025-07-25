/* Copyright (c) 2024, VRAI Labs and/or its affiliates. All rights reserved.
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
import SuperTokens from "supertokens-react-native";
import { disableLogging } from "supertokens-react-native/lib/build/logger";
import { setupFetchWithCookieJar } from "./utils";
// jest does not call setupFiles properly with the new react-native init, so doing it this way instead
import "./setup";

process.env.TEST_MODE = "testing";

describe("Logger test", () => {
    const consoleSpy = jest.spyOn(console, "log");

    beforeEach(() => {
        disableLogging();
        setupFetchWithCookieJar();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should log to console when debug logging is enabled", async () => {
        SuperTokens.init({
            apiDomain: "http://localhost:3000",
            enableDebugLogs: true
        });

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("init: called"));
    });

    it("should not log to console when debug logging is disabled", async () => {
        SuperTokens.init({
            apiDomain: "http://localhost:3000",
            enableDebugLogs: false
        });

        expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("init: called"));
    });

    it("should not log to console when no argument is passed for enableDebugLogs", async () => {
        SuperTokens.init({
            apiDomain: "http://localhost:3000"
        });

        expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("init: called"));
    });
});
