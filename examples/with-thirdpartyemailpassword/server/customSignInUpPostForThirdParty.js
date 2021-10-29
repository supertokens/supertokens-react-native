let axios = require("axios");
let qs = require("querystring");
let Session = require("supertokens-node/recipe/session");

async function customSignInUpPostForThirdParty(input, originalImplementation) {
    let {
        provider,
        code,
        redirectURI,
        options,
    } = input;

    let accessTokenAPIResponse = (await options.req.getJSONBody()).authCodeResponse;

    if (accessTokenAPIResponse === undefined) {
        return originalImplementation.thirdPartySignInUpPOST(input);
    }

    let userInfo;

    let providerInfo = await provider.get(redirectURI, code);

    userInfo = await providerInfo.getProfileInfo(accessTokenAPIResponse);
    console.log(userInfo);

    let emailInfo = userInfo.email;
    if (emailInfo === undefined) {
        return {
            status: "NO_EMAIL_GIVEN_BY_PROVIDER",
        };
    }
    let response = await options.recipeImplementation.signInUp({
        thirdPartyId: provider.id,
        thirdPartyUserId: userInfo.id,
        email: emailInfo,
    });

    if (response.status === "FIELD_ERROR") {
        return response;
    }

    // we set the email as verified if already verified by the OAuth provider.
    // This block was added because of https://github.com/supertokens/supertokens-core/issues/295
    if (emailInfo.isVerified) {
        const tokenResponse = await options.emailVerificationRecipeImplementation.createEmailVerificationToken({
            userId: response.user.id,
            email: response.user.email,
        });

        if (tokenResponse.status === "OK") {
            await options.emailVerificationRecipeImplementation.verifyEmailUsingToken({
                token: tokenResponse.token,
            });
        }
    }

    // let action= response.createdNewUser ? "signup" : "signin";
    // let jwtPayloadPromise = options.config.sessionFeature.setJwtPayload(
    //     response.user,
    //     accessTokenAPIResponse.data,
    //     action
    // );
    // let sessionDataPromise = options.config.sessionFeature.setSessionData(
    //     response.user,
    //     accessTokenAPIResponse.data,
    //     action
    // );

    // let jwtPayload = await jwtPayloadPromise;
    // let sessionData = await sessionDataPromise;

    await Session.createNewSession(options.res, response.user.id, {}, {});
    return {
        status: "OK",
        createdNewUser: response.createdNewUser,
        user: response.user,
        authCodeResponse: accessTokenAPIResponse.data,
    };
}

module.exports = customSignInUpPostForThirdParty;