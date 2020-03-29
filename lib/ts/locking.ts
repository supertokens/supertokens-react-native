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

import { InteractionManager } from "react-native";

/*
    WARNING: Do not acquire a lock and then re acquire the same lock without
             releasing that lock first!!
*/
class Locking {
    static instance: undefined | Locking;
    private locked: Map<string, (() => void)[]> = new Map<string, (() => void)[]>();

    static getInstance() {
        if (Locking.instance === undefined) {
            Locking.instance = new Locking();
        }
        return Locking.instance;
    }

    private addToLocked = (key: string, toAdd?: () => void) => {
        let callbacks = this.locked.get(key);
        if (callbacks === undefined) {
            if (toAdd === undefined) {
                this.locked.set(key, []);
            } else {
                this.locked.set(key, [toAdd]);
            }
        } else {
            if (toAdd !== undefined) {
                callbacks.unshift(toAdd);
                this.locked.set(key, callbacks);
            }
        }
    };

    isLocked = (key: string): boolean => {
        return this.locked.has(key);
    };

    lock = (key: string): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            if (this.isLocked(key)) {
                this.addToLocked(key, resolve);
            } else {
                this.addToLocked(key);
                resolve();
            }
        });
    };

    unlock = (key: string) => {
        let callbacks = this.locked.get(key);
        if (callbacks === undefined || callbacks.length === 0) {
            this.locked.delete(key);
            return;
        }
        let toCall = callbacks.pop();
        this.locked.set(key, callbacks);
        if (toCall !== undefined) {
            InteractionManager.runAfterInteractions(toCall);
        }
    };
}

export default function getLock(): Locking {
    return Locking.getInstance();
}
