# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.1] - 2021-10-28

### Changes
-   Uses non arrow functions in api and recipe interface impl to allow for "true" inheritance in override: https://github.com/supertokens/supertokens-node/issues/199
-   Uses `bind(this)` when calling original implementation

## [3.0.0] - 2021-10-22
### Breaking changes
- `getJWTPayloadSecurely` has been renamed to `getAccessTokenPayloadSecurely` to be more accurate to the functionality

## [2.0.0] - 2021-10-14
This is a major update to the SDK and contains several breaking changes, please go through the list mentioned below and the documentation to understand how to upgrade to version `2.0.0`
### Added
- Sign out support
- Adds `preAPIHook` and `onHandleEvent` functions, when calling `init`
- `SESSION_CREATED` event, which can be consumed by `onHandleEvent`
- Fires `UNAUTHORISED` event before attempting to refresh if we know that a session does not exist.
- Fires `SIGN_OUT` event when `signOut` is called and a session doesn't exist.
- Adds the ability to get userId and JWT payload (securely) from the frontend
- Sends `rid` on each request - acts as a CSRF protection measure
- Adds `base-64` as a dependency
- The ability to override functions when calling `init`
### Changed
- Automatically adds credentials to `fetch` and `axios`, this can be disabled when calling `init`
- Changed success refresh call status code to >= 200 && < 300
- Network requests no longer send frontend SDK version
- New FDI supported versions - `1.8` and `1.9`
- Not calling refresh after API calls if the refresh API returned an error
- Not calling refresh after an 401 response has removed the session
- Enforce interception for fetch and axios for easier use
- Minor changes and refactors to the overall structure of the package
### Breaking changes
- The package now uses `@react-native-async-storage/async-storage` (instead of `@react-native-community`)
- Async storage is now a peer dependency, the package will not function properly unless you install `@react-native-async-storage/async-storage` version 1.12.1 or higher
- `makeSuper` has been replaced by `addAxiosInterceptors` which is now exposed by the default import
- The signature of the `init` function has changed
- When importing from `"supertokens-react-native/axios"` the `init` function is no longer available. Refer to the documentation to know how to initialise SuperTokens when using `axios`.
- Changed the default session expiry status code to `401`
- The refresh API will alway be `apiDomain + apiBasePath + "/session/refresh"`, both `apiDomain` and `apiBasePath` are passed when calling `init`
- Removes `refreshAPICustomHeaders` when calling `init`, use `preAPIHook` instead
- Rejecting with axios response object if a call through axios gets an unexpected error during session refresh. This is a breaking change since it changes the API (even if it's an error).
- Removes the `get`, `post`, `put`, `delete` and `fetch`/`axios` methods from the default `/fetch` and `/axios` imports. Use request/response interception instead, enabled by default for `fetch` (view documentation for `axios`).
- Removes the `doesSessionExist` function from the default `/axios` import, it is now exposed fro mthe default import of the package for both `axios` and `fetch`

## [1.2.1] - 2020-10-03
### Changed
- Refresh API succeeds if status code is >=200 && < 300
- Uses `@react-native-community/async-storage`

## [1.2.0] - 2020-09-11
### Changed
- Compatibility with FDI 1.2

## [1.1.0] - 2020-08-11
### Changed
- Default session expiry status code is 401
- Changes to `init` function
- If using `fetch`, makes that interception on by default

## [1.0.1] - 2020-06-14
### Fixes
- Resolved cyclic dependency between index.tx and handleUnauthorised.ts 

