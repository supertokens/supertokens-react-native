let express = require("express");
let supertokens = require("supertokens-node");
let Session = require("supertokens-node/recipe/session");
let ThirdPartyEmailPassword = require("supertokens-node/recipe/thirdpartyemailpassword");
let { Google, Github } = ThirdPartyEmailPassword;
let axios = require("axios");
let qs = require("querystring");
let customSignInUpPostForThirdParty = require("./customSignInUpPostForThirdParty");



supertokens.init({
    framework: "express",
    supertokens: {
        // try.supertokens.io is for demo purposes. Replace this with the address of your core instance (sign up on supertokens.io), or self host a core.
        connectionURI: "https://try.supertokens.io",
        // apiKey: "IF YOU HAVE AN API KEY FOR THE CORE, ADD IT HERE",
    },
    appInfo: {
        // learn more about this on https://supertokens.io/docs/thirdpartyemailpassword/appinfo
        appName: "Demo App",
        apiDomain: "http://localhost:3001",
        websiteDomain: "http://localhost:3000",
    },
    recipeList: [
        ThirdPartyEmailPassword.init({
            providers: [
                Google({
                    clientId: "",
                    clientSecret: ""
                }),
                Github({
                    clientId: "8a9152860ce869b64c44",
                    clientSecret: "00e841f10f288363cd3786b1b1f538f05cfdbda2",
                })
            ],
            override: {
                apis: (originalImplementation) => {
                    return {
                        ...originalImplementation,
                        thirdPartySignInUpPOST: async function (input) {
                            return customSignInUpPostForThirdParty(input, originalImplementation);
                        },
                    }
                }
            }
        }),
        Session.init() // initializes session features
    ]
});

let cors = require("cors");

let { middleware } = require("supertokens-node/framework/express");

let app = express();

// ...other middlewares
app.use(cors({
    origin: "http://localhost:3000",
    allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
    credentials: true,
}));

app.use(middleware());
app.use(express.json());

app.get("/test", async (req, res) => {
    res.status(200).json({ success: true });
});

// ...your API routes

let { errorHandler } = require("supertokens-node/framework/express");
// ...your API routes

// Add this AFTER all your routes
app.use(errorHandler())

app.listen(3001, () => { });
