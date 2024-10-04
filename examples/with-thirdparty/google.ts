import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { API_DOMAIN } from "./constants";

export const performGoogleSignIn = async (): Promise<boolean> => {
  GoogleSignin.configure({
    webClientId: "GOOGLE_WEB_CLIENT_ID",
    iosClientId: "GOOGLE_IOS_CLIENT_ID",
  });

  try {
    const user = await GoogleSignin.signIn({});

    const response = await fetch(API_DOMAIN + "/auth/signinup", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        thirdPartyId: "google",
        redirectURIInfo: {
          redirectURIOnProviderDashboard: "https://example.com", // this value doesn't matter cause it's mobile login, and Google doesn't check it, but our APIs need some value for it.
          redirectURIQueryParams: {
            code: user.serverAuthCode,
          },
        },
      }),
    });

    if (response.status !== 200) {
      throw new Error();
    }

    return true;
  } catch (e) {
    console.log("Google sign in failed with error", e);
  }

  return false;
};
