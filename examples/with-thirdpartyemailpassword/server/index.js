let express = require("express");
let supertokens = require("supertokens-node");
let Session = require("supertokens-node/recipe/session");
let ThirdPartyEmailPassword = require("supertokens-node/recipe/thirdpartyemailpassword");
let { Google, Github } = ThirdPartyEmailPassword;
let cors = require("cors");
let { middleware } = require("supertokens-node/framework/express");
let { errorHandler } = require("supertokens-node/framework/express");

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
                /*
                    For Google we use react-native-app-auth to fetch the access_token from Google servers directly
                    and then send that to the /auth/signinup API to fetch user information and create a session.

                    Because of this flow, we do not need to provide the clientId and secret when initialising the Google
                    third party provider
                */
                Google({
                    clientId: "",
                    clientSecret: ""
                }),
                Github({
                    clientId: "8a9152860ce869b64c44",
                    clientSecret: "00e841f10f288363cd3786b1b1f538f05cfdbda2",
                }),
                /*
                    For sign in with Apple we need a different client ID for iOS and a different one for Android. We
                    achieve this by configuring two providers for Apple with different clientIds.

                    For iOS the frontend sends the clientId in the request when calling the /auth/signinup API, which is
                    used to determine which provider should be used.

                    "isDefault: true" indicates which provider should be used when the request from the frontend does not
                    contain a clientId. For example, in the frontend for this demo app when we sign in with Apple on Android
                    the frontend does not send a clientId when calling the /auth/signinup API. In this case we pick the provider
                    which has isDefault set to true.

                    Note: Only one provider per third party provider type (Google, Apple, Github etc) can be set to default,
                */
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

let app = express();

app.use(cors({
    origin: "http://localhost:3000",
    allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
    credentials: true,
}));

app.use(middleware());
app.use(express.json());

app.use(errorHandler())

app.listen(apiPort, () => { });
