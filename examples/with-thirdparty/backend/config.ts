import ThirdParty from "supertokens-node/recipe/thirdparty";
import Session from "supertokens-node/recipe/session";
import { TypeInput } from "supertokens-node/types";
import Dashboard from "supertokens-node/recipe/dashboard";

export const SuperTokensConfig: TypeInput = {
  supertokens: {
    // this is the location of the SuperTokens core.
    connectionURI: "https://try.supertokens.com",
  },
  appInfo: {
    appName: "SuperTokens Demo App",
    apiDomain: "http://192.168.29.87:3001",
    websiteDomain: "http://localhost:3000", // this value does not matter for the android app
  },
  // recipeList contains all the modules that you want to
  // use from SuperTokens. See the full list here: https://supertokens.com/docs/guides
  recipeList: [
    ThirdParty.init({
      signInAndUpFeature: {
        providers: [
          // We have provided you with development keys which you can use for testing.
          // IMPORTANT: Please replace them with your own OAuth keys for production use.
          {
            config: {
              thirdPartyId: "google",
              clients: [
                {
                  clientId: "GOOGLE_WEB_CLIENT_ID",
                  clientSecret: "GOOGLE_WEB_CLIENT_SECRET",
                },
              ],
            },
          },
          {
            config: {
              thirdPartyId: "github",
              clients: [
                {
                  clientId: "GITHUB_CLIENT_ID",
                  clientSecret: "GITHUB_CLIENT_SECRET",
                },
              ],
            },
          },
          {
            config: {
              thirdPartyId: "apple",
              clients: [
                {
                  clientId: "APPLE_CLIENT_ID",
                  additionalConfig: {
                    keyId: "APPLE_KEY_ID",
                    privateKey: "APPLE_PRIVATE_KEY",
                    teamId: "APPLE_TEAM_ID",
                  },
                },
              ],
            },
          },
        ],
      },
    }),
    Session.init(),
    Dashboard.init(),
  ],
};
