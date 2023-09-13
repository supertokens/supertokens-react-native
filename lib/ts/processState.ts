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

export enum PROCESS_STATE {
    //CALLING_INTERCEPTION_REQUEST : Process state for the request interceptor.
    //CALLING_INTERCEPTION_RESOPONSE : Process state for the response interceptor.
    CALLING_INTERCEPTION_REQUEST,
    CALLING_INTERCEPTION_RESPONSE
}

declare let process: any;

export class ProcessState {
    history: PROCESS_STATE[] = [];
    private static instance: ProcessState | undefined;

    static getInstance() {
        if (ProcessState.instance == undefined) {
            ProcessState.instance = new ProcessState();
        }
        return ProcessState.instance;
    }

    addState = (state: PROCESS_STATE) => {
        try {
            if (process !== undefined && process.env !== undefined && process.env.TEST_MODE === "testing") {
                this.history.push(state);
            }
        } catch (_) {}
    };

    private getEventByLastEventByName = (state: PROCESS_STATE) => {
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i] == state) {
                return this.history[i];
            }
        }
        return undefined;
    };

    reset = () => {
        this.history = [];
    };

    waitForEvent = async (state: PROCESS_STATE, timeInMS = 7000) => {
        let startTime = Date.now();
        return new Promise(resolve => {
            let actualThis = this;
            function tryAndGet() {
                let result = actualThis.getEventByLastEventByName(state);
                if (result === undefined) {
                    if (Date.now() - startTime > timeInMS) {
                        resolve(undefined);
                    } else {
                        setTimeout(tryAndGet, 1000);
                    }
                } else {
                    resolve(result);
                }
            }
            tryAndGet();
        });
    };
}
