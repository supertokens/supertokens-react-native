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
let SuperTokens = require("supertokens-node");
let SuperTokensRaw = require("supertokens-node/lib/build/supertokens").default;
let SessionRecipeRaw = require("supertokens-node/lib/build/recipe/session/recipe").default;
let Session = require("supertokens-node/recipe/session");
let express = require("express");
let cookieParser = require("cookie-parser");
let bodyParser = require("body-parser");
let http = require("http");
let cors = require("cors");

let {
    maxVersion,
    isProtectedPropName,
    getCoreUrl,
    createCoreApplication,
    addLicense

} = require("./utils");
let { middleware, errorHandler } = require("supertokens-node/framework/express");
let { verifySession } = require("supertokens-node/recipe/session/framework/express");
let { version: nodeSDKVersion } = require("supertokens-node/lib/build/version");
let Querier = require("supertokens-node/lib/build/querier").Querier;
let NormalisedURLPath = require("supertokens-node/lib/build/normalisedURLPath").default;
const morgan = require("morgan");
let noOfTimesRefreshCalledDuringTest = 0;
let noOfTimesGetSessionCalledDuringTest = 0;
let noOfTimesRefreshAttemptedDuringTest = 0;
let Multitenancy, MultitenancyRaw, multitenancySupported;
try {
    MultitenancyRaw = require("supertokens-node/lib/build/recipe/multitenancy/recipe").default;
    Multitenancy = require("supertokens-node/lib/build/recipe/multitenancy/index");
    multitenancySupported = true;
} catch {
    multitenancySupported = false;
}

let UserMetaDataRecipeRaw;
try {
    UserMetaDataRecipeRaw = require("supertokens-node/lib/build/recipe/usermetadata/recipe").default;
} catch {
    // Ignored
}

let generalErrorSupported;

if (maxVersion(nodeSDKVersion, "10.0.0") === nodeSDKVersion) {
    // General error is only supported by 10.0.0 and above
    generalErrorSupported = true;
} else {
    generalErrorSupported = false;
}

let accountLinkingSupported = maxVersion(nodeSDKVersion, "16.0") === nodeSDKVersion;

function reset() {
    SuperTokensRaw.reset();
    SessionRecipeRaw.reset();

    if (multitenancySupported) {
        MultitenancyRaw.reset();
    }

    if (UserMetaDataRecipeRaw !== undefined) {
        UserMetaDataRecipeRaw.reset();
    }

    if (accountLinkingSupported) {
        const AccountLinkingRaw = require("supertokens-node/lib/build/recipe/accountlinking/recipe").default;
        AccountLinkingRaw.reset();
    }
}

function getConfig({coreUrl = getCoreUrl(), enableAntiCsrf, enableJWT, tokenTransferMethod}) {
    if (maxVersion(nodeSDKVersion, "14.0") === nodeSDKVersion && enableJWT) {
        return {
            appInfo: {
                appName: "SuperTokens",
                apiDomain: "0.0.0.0:" + (process.env.NODE_PORT === undefined ? 8080 : process.env.NODE_PORT),
                websiteDomain: "http://localhost:8080"
            },
            supertokens: {
                connectionURI: coreUrl
            },
            recipeList: [
                Session.init({
                    exposeAccessTokenToFrontendInCookieBasedAuth: true,
                    getTokenTransferMethod: () => tokenTransferMethod,
                    errorHandlers: {
                        onUnauthorised: (err, req, res) => {
                            res.setStatusCode(401);
                            res.sendJSONResponse({});
                        }
                    },
                    antiCsrf: enableAntiCsrf ? "VIA_TOKEN" : "NONE",
                    override: {
                        apis: oI => {
                            return {
                                ...oI,
                                refreshPOST: undefined,
                                signOutPOST: async input => {
                                    let body = await input.options.req.getJSONBody();
                                    if (body.generalError === true) {
                                        return {
                                            status: "GENERAL_ERROR",
                                            message: "general error from signout API"
                                        };
                                    }
                                    return oI.signOutPOST(input);
                                }
                            };
                        },
                        functions: oI => {
                            return {
                                ...oI,
                                createNewSession: async input => {
                                    const accessTokenPayload = {
                                        ...input.accessTokenPayload,
                                        customClaim: "customValue"
                                    };

                                    return oI.createNewSession({
                                        ...input,
                                        accessTokenPayload
                                    });
                                }
                            };
                        }
                    }
                })
            ]
        };
    }

    if (maxVersion(nodeSDKVersion, "8.3") === nodeSDKVersion && enableJWT) {
        return {
            appInfo: {
                appName: "SuperTokens",
                apiDomain: "0.0.0.0:" + (process.env.NODE_PORT === undefined ? 8080 : process.env.NODE_PORT),
                websiteDomain: "http://localhost:8080"
            },
            supertokens: {
                connectionURI: coreUrl
            },
            recipeList: [
                Session.init({
                    jwt: {
                        enable: true
                    },
                    getTokenTransferMethod: () => tokenTransferMethod,
                    errorHandlers: {
                        onUnauthorised: (err, req, res) => {
                            res.setStatusCode(401);
                            res.sendJSONResponse({});
                        }
                    },
                    antiCsrf: enableAntiCsrf ? "VIA_TOKEN" : "NONE",
                    override: {
                        apis: oI => {
                            return {
                                ...oI,
                                refreshPOST: undefined,
                                signOutPOST: async input => {
                                    let body = await input.options.req.getJSONBody();
                                    if (body.generalError === true) {
                                        return {
                                            status: "GENERAL_ERROR",
                                            message: "general error from signout API"
                                        };
                                    }
                                    return oI.signOutPOST(input);
                                }
                            };
                        },
                        functions: oI => {
                            return {
                                ...oI,
                                createNewSession: async input => {
                                    const accessTokenPayload = {
                                        ...input.accessTokenPayload,
                                        customClaim: "customValue"
                                    };

                                    return oI.createNewSession({
                                        ...input,
                                        accessTokenPayload
                                    });
                                }
                            };
                        }
                    }
                })
            ]
        };
    }

    return {
        appInfo: {
            appName: "SuperTokens",
            apiDomain: "0.0.0.0:" + (process.env.NODE_PORT === undefined ? 8080 : process.env.NODE_PORT),
            websiteDomain: "http://localhost:8080"
        },
        supertokens: {
            connectionURI: coreUrl
        },
        recipeList: [
            Session.init({
                getTokenTransferMethod: () => tokenTransferMethod,
                errorHandlers: {
                    onUnauthorised: (err, req, res) => {
                        res.setStatusCode(401);
                        res.sendJSONResponse({});
                    }
                },
                antiCsrf: enableAntiCsrf ? "VIA_TOKEN" : "NONE",
                override: {
                    apis: oI => {
                        return {
                            ...oI,
                            refreshPOST: undefined,
                            signOutPOST: async input => {
                                let body = await input.options.req.getJSONBody();
                                if (body.generalError === true) {
                                    return {
                                        status: "GENERAL_ERROR",
                                        message: "general error from signout API"
                                    };
                                }
                                return oI.signOutPOST(input);
                            }
                        };
                    }
                }
            })
        ]
    };
}

function initST({coreUrl = getCoreUrl(), enableAntiCsrf = true, enableJWT = false, tokenTransferMethod} = {}) {
    reset();
    SuperTokens.init(getConfig({coreUrl, enableAntiCsrf, enableJWT, tokenTransferMethod}));
}

// Initialize ST once to ensure all endpoints work
initST();
// Add license before the server starts
(async function () {
    await addLicense();
})();

let urlencodedParser = bodyParser.urlencoded({ limit: "20mb", extended: true, parameterLimit: 20000 });
let jsonParser = bodyParser.json({ limit: "20mb" });

let app = express();
app.use(urlencodedParser);
app.use(jsonParser);
app.use(cookieParser());
app.use(morgan(`:date[iso] - :method :url`, { immediate: true }));
app.use(morgan(`:date[iso] - :method :url :status :response-time ms - :res[content-length]`));

app.use(
    cors({
        origin: "http://localhost:8080",
        allowedHeaders: ["content-type", ...SuperTokens.getAllCORSHeaders()],
        methods: ["GET", "PUT", "POST", "DELETE"],
        credentials: true
    })
);
app.disable("etag");

app.use(middleware());

app.post("/login", async (req, res) => {
    let userId = req.body.userId;

    let session;
    if (multitenancySupported) {
        session = await Session.createNewSession(
            req,
            res,
            "public",
            accountLinkingSupported ? SuperTokens.convertToRecipeUserId(userId) : userId
        );
    } else {
        session = await Session.createNewSession(req, res, userId);
    }

    res.send(session.userId);
});

app.post("/test/setup/app", async (req, res) => {
    const { appId, coreConfig } = req.body;
    const coreAppUrl = await createCoreApplication({ appId, coreConfig });
    res.status(200).send(coreAppUrl);
});

app.post("/test/setup/st", async (req, res) => {
    const {coreUrl, enableAntiCsrf, enableJWT, tokenTransferMethod} = req.body;
    await initST({coreUrl, enableAntiCsrf, enableJWT, tokenTransferMethod});
    res.send("");
});

app.post("/beforeeach", async (req, res) => {
    noOfTimesRefreshCalledDuringTest = 0;
    noOfTimesGetSessionCalledDuringTest = 0;
    noOfTimesRefreshAttemptedDuringTest = 0;
    reset();
    initST();
    res.send();
});

app.post("/after", async (req, res) => {
    reset();
    initST();
    res.send();
});


app.post("/testUserConfig", async (req, res) => {
    res.status(200).send();
});

app.post("/multipleInterceptors", async (req, res) => {
    res.status(200).send(
        req.headers.interceptorheader2 !== undefined && req.headers.interceptorheader1 !== undefined
            ? "success"
            : "failure"
    );
});

app.get(
    "/",
    (req, res, next) => verifySession()(req, res, next),
    async (req, res) => {
        noOfTimesGetSessionCalledDuringTest += 1;
        res.send(req.session.getUserId());
    }
);

app.get(
    "/check-rid",
    (req, res, next) => verifySession()(req, res, next),
    async (req, res) => {
        let response = req.headers["rid"];
        res.send(response !== "anti-csrf" ? "fail" : "success");
    }
);

app.get("/check-rid-no-session", async (req, res) => {
    let rid = req.headers["rid"];
    res.send(!rid || !rid.startsWith("anti-csrf") ? "fail" : "success");
});

app.get(
    "/update-jwt",
    (req, res, next) => verifySession()(req, res, next),
    async (req, res) => {
        if (req.session.getJWTPayload !== undefined) {
            res.json(req.session.getJWTPayload());
        } else {
            res.json(req.session.getAccessTokenPayload());
        }
    }
);

app.post(
    "/update-jwt",
    (req, res, next) => verifySession()(req, res, next),
    async (req, res) => {
        if (req.session.getJWTPayload !== undefined) {
            await req.session.updateJWTPayload(req.body);
            res.json(req.session.getJWTPayload());
        } else if (req.session.updateAccessTokenPayload !== undefined) {
            await req.session.updateAccessTokenPayload(req.body);
            res.json(req.session.getAccessTokenPayload());
        } else {
            let clearing = {};

            for (const key of Object.keys(req.session.getAccessTokenPayload())) {
                if (!isProtectedPropName(key)) {
                    clearing[key] = null;
                }
            }
            await req.session.mergeIntoAccessTokenPayload({ ...clearing, ...req.body });
            res.json(req.session.getAccessTokenPayload());
        }
    }
);

app.use("/testing", async (req, res) => {
    let tH = req.headers["testing"];
    if (tH !== undefined) {
        res.header("testing", tH);
    }
    res.send("success");
});

app.post(
    "/logout",
    (req, res, next) => verifySession()(req, res, next),
    async (req, res) => {
        await req.session.revokeSession();
        res.send("success");
    }
);

app.post(
    "/revokeAll",
    (req, res, next) => verifySession()(req, res, next),
    async (req, res) => {
        let userId = req.session.getUserId();
        await SuperTokens.revokeAllSessionsForUser(userId);
        res.send("success");
    }
);

app.post("/auth/session/refresh", async (req, res, next) => {
    noOfTimesRefreshAttemptedDuringTest += 1;
    verifySession()(req, res, err => {
        if (err) {
            next(err);
        } else {
            if (req.headers["rid"] === undefined) {
                res.send("refresh failed");
            } else {
                refreshCalled = true;
                noOfTimesRefreshCalledDuringTest += 1;
                res.send("refresh success");
            }
        }
    });
});

app.get("/refreshCalledTime", async (req, res) => {
    res.status(200).send("" + noOfTimesRefreshCalledDuringTest);
});

app.get("/refreshAttemptedTime", async (req, res) => {
    res.status(200).send("" + noOfTimesRefreshAttemptedDuringTest);
});

app.get("/getSessionCalledTime", async (req, res) => {
    res.status(200).send("" + noOfTimesGetSessionCalledDuringTest);
});
app.get("/getPackageVersion", async (req, res) => {
    res.status(200).send("" + package_version);
});

app.get("/ping", async (req, res) => {
    res.send("success");
});

app.get("/testHeader", async (req, res) => {
    let testHeader = req.headers["st-custom-header"];
    let success = true;
    if (testHeader === undefined) {
        success = false;
    }
    let data = {
        success
    };
    res.send(JSON.stringify(data));
});

app.post("/checkAllowCredentials", (req, res) => {
    res.send(req.headers["allow-credentials"] !== undefined ? true : false);
});

app.get("/index.html", (req, res) => {
    res.sendFile("index.html", { root: __dirname });
});
app.get("/testError", (req, res) => {
    res.status(500).send("test error message");
});

app.get("/test/featureFlags", (req, res) => {
    const available = [];

    if (generalErrorSupported) {
        available.push("generalerror");
    }

    if (maxVersion(nodeSDKVersion, "12.0") === nodeSDKVersion) {
        available.push("sessionClaims");
    }

    if (maxVersion(nodeSDKVersion, "14.0") === nodeSDKVersion) {
        available.push("v3AccessToken");
    }

    res.send({
        available
    });
});

app.post("/login-2.18", async (req, res) => {
    // This CDI version is no longer supported by this SDK, but we want to ensure that sessions keep working after the upgrade
    // We can hard-code the structure of the request&response, since this is a fixed CDI version and it's not going to change
    Querier.apiVersion = "2.18";
    const payload = req.body.payload || {};
    const userId = req.body.userId;

    let path = undefined;
    if (maxVersion(nodeSDKVersion, "23.0.0") === nodeSDKVersion) {
        path = {
            path: "/recipe/session",
            params: {},
        };
    } else {
        path = new NormalisedURLPath("/recipe/session");
    }

    const legacySessionResp = await Querier.getNewInstanceOrThrowError().sendPostRequest(
        path,
        {
            userId,
            enableAntiCsrf: false,
            userDataInJWT: payload,
            userDataInDatabase: {}
        },
        {}
    );
    Querier.apiVersion = undefined;

    const legacyAccessToken = legacySessionResp.accessToken.token;
    const legacyRefreshToken = legacySessionResp.refreshToken.token;

    res.set("st-access-token", legacyAccessToken)
        .set("st-refresh-token", legacyRefreshToken)
        .set(
            "front-token",
            Buffer.from(
                JSON.stringify({
                    uid: userId,
                    ate: Date.now() + 3600000,
                    up: payload
                })
            ).toString("base64")
        )
        .send();
});

app.post("/logout-alt", async (req, res) => {
    res.status(200)
        .header("front-token", "remove")
        .json({});
});

app.use("*", async (req, res, next) => {
    res.status(404).send();
});

app.use(errorHandler());

app.use(async (err, req, res, next) => {
    console.log({ err, stack: new Error().stack });
    res.status(500).send(err);
});

let server = http.createServer(app);
// server.listen(process.env.NODE_PORT === undefined ? 8080 : process.env.NODE_PORT, "::");
server.listen(8080, "::");
