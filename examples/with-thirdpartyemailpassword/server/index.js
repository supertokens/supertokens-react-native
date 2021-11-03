let express = require("express");
let supertokens = require("supertokens-node");
let Session = require("supertokens-node/recipe/session");
let ThirdPartyEmailPassword = require("supertokens-node/recipe/thirdpartyemailpassword");
let { Google, Github } = ThirdPartyEmailPassword;

const apiPort = 3001;
const apiDomain = "http://localhost:" + apiPort

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
        apiDomain: apiDomain,
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
                }),
                ThirdPartyEmailPassword.Apple({
                    isDefault: true,
                    clientId: "4398792-io.supertokens.example.service",
                    clientSecret: {
                        keyId: "7M48Y4RYDL",
                        privateKey: "-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgu8gXs+XYkqXD6Ala9Sf/iJXzhbwcoG5dMh1OonpdJUmgCgYIKoZIzj0DAQehRANCAASfrvlFbFCYqn3I2zeknYXLwtH30JuOKestDbSfZYxZNMqhF/OzdZFTV0zc5u5s3eN+oCWbnvl0hM+9IW0UlkdA\n-----END PRIVATE KEY-----",
                        teamId: "YWQCXGJRJL"
                    }
                }),
                ThirdPartyEmailPassword.Apple({
                    clientId: "4398792-io.supertokens.example",
                    clientSecret: {
                        keyId: "7M48Y4RYDL",
                        privateKey: "-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgu8gXs+XYkqXD6Ala9Sf/iJXzhbwcoG5dMh1OonpdJUmgCgYIKoZIzj0DAQehRANCAASfrvlFbFCYqn3I2zeknYXLwtH30JuOKestDbSfZYxZNMqhF/OzdZFTV0zc5u5s3eN+oCWbnvl0hM+9IW0UlkdA\n-----END PRIVATE KEY-----",
                        teamId: "YWQCXGJRJL"
                    }
                }),
            ],
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

// ...your API routes

let { errorHandler } = require("supertokens-node/framework/express");
// ...your API routes

// Add this AFTER all your routes
app.use(errorHandler())

app.use((err, req, res, next) => {
    // Handle error
});

app.listen(apiPort, () => { });
