import SuperTokens, {
    addAxiosInterceptors,
    doesSessionExist,
    getUserId,
    getJWTPayloadSecurely,
    attemptRefreshingSession,
    signOut,
    init,
} from "../../";
import axios from "axios";

SuperTokens.addAxiosInterceptors(axios);
addAxiosInterceptors(axios);

SuperTokens.doesSessionExist().then(b => {
    console.log(b);
}).catch(err => {
    console.log(err);
});
doesSessionExist().then(b => {
    console.log(b);
}).catch(err => {
    console.log(err);
});

SuperTokens.getUserId().then(id => {
    console.log(id);
}).catch(err => {
    console.log(err);
});
getUserId().then(id => {
    console.log(id);
}).catch(err => {
    console.log(err);
});

SuperTokens.getJWTPayloadSecurely().then(payload => {
    console.log(payload);
}).catch(err => {
    console.log(err);
});
getJWTPayloadSecurely().then(payload => {
    console.log(payload);
}).catch(err => {
    console.log(err);
});

SuperTokens.attemptRefreshingSession().then(retry => {
    console.log(retry);
}).catch(err => {
    console.log(err);
});
attemptRefreshingSession().then(retry => {
    console.log(retry);
}).catch(err => {
    console.log(err);
})

SuperTokens.signOut().then(() => {
}).catch(err => {
    console.log(err);
});
signOut().then(() => {
}).catch(err => {
    console.log(err);
});

SuperTokens.init({
    apiDomain: "",
});
init({
    apiDomain: "",
});

SuperTokens.init({
    apiDomain: "",
    apiBasePath: "",
    autoAddCredentials: true,
    sessionExpiredStatusCode: 401,
    cookieDomain: "",
    onHandleEvent: async (context) => {

    },
    preAPIHook: async (context) => {
        return context;
    },
    override: {
        functions: (oI) => {
            return {
                ...oI,
                signOut: async (config) => {
                    return oI.signOut(config);
                },
            }
        }
    }
});
init({
    apiDomain: "",
    apiBasePath: "",
    autoAddCredentials: true,
    sessionExpiredStatusCode: 401,
    cookieDomain: "",
    onHandleEvent: async (context) => {

    },
    preAPIHook: async (context) => {
        return context;
    },
    override: {
        functions: (oI) => {
            return {
                ...oI,
                signOut: async (config) => {
                    return oI.signOut(config);
                },
            }
        }
    }
});