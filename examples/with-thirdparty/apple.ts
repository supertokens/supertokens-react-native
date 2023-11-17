import { appleAuth } from "@invertase/react-native-apple-authentication";
import { API_DOMAIN } from "./constants";

export const performAppleLogin = async (): Promise<boolean> => {
  try {
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      // Note: it appears putting FULL_NAME first is important, see issue https://github.com/invertase/react-native-apple-authentication/issues/293
      requestedScopes: [appleAuth.Scope.EMAIL],
    });

    const response = await fetch(API_DOMAIN + "/auth/signinup", {
      method: "POST",
      body: JSON.stringify({
        thirdPartyId: "apple",
        redirectURIInfo: {
          redirectURIOnProviderDashboard: "",
          redirectURIQueryParams: {
            code: appleAuthRequestResponse.authorizationCode,
          },
        },
      }),
    });

    if (response.status !== 200) {
      throw new Error();
    }

    return true;
  } catch (e) {
    console.log("Apple sign in failed with error", e);
  }

  return false;
};
