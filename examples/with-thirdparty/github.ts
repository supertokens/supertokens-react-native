import { authorize } from "react-native-app-auth";
import { API_DOMAIN } from "./constants";

export const performGithubLogin = async (): Promise<boolean> => {
  try {
    const result = await authorize({
      serviceConfiguration: {
        authorizationEndpoint: "https://github.com/login/oauth/authorize",
        tokenEndpoint: "https://github.com/login/oauth/access_token",
        revocationEndpoint:
          "https://github.com/settings/connections/applications/<client-id>",
      },
      additionalHeaders: { Accept: "application/json" },
      clientId: "GITHUB_CLIENT_ID",
      redirectUrl: "com.supertokens.supertokensexample://oauthredirect",
      scopes: ["user"],
      skipCodeExchange: true,
    });

    const response = await fetch(API_DOMAIN + "/auth/signinup", {
      method: "POST",
      body: JSON.stringify({
        thirdPartyId: "github",
        redirectURIInfo: {
          redirectURIOnProviderDashboard: "",
          redirectURIQueryParams: {
            code: result.authorizationCode,
          },
        },
      }),
    });

    if (response.status !== 200) {
      throw new Error();
    }

    return true;
  } catch (e) {
    console.log("Github login failed with error", e);
  }

  return false;
};
