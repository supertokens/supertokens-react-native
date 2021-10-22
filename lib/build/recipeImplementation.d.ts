import { RecipeInterface, NormalisedInputType } from "./types";
export default class RecipeImplementation implements RecipeInterface {
    addFetchInterceptorsAndReturnModifiedFetch: (originalFetch: any, _: NormalisedInputType) => typeof fetch;
    addAxiosInterceptors: (axiosInstance: any, _: NormalisedInputType) => void;
    getUserId: (config: NormalisedInputType) => Promise<string>;
    getAccessTokenPayloadSecurely: (config: NormalisedInputType) => Promise<any>;
    doesSessionExist: (config: NormalisedInputType) => Promise<boolean>;
    signOut: (config: NormalisedInputType) => Promise<void>;
}
