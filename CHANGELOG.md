# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

## [5.0.2] - 2024-05-28

- Adds FDI 2.0 and 3.0 to the list of supported FDI versions

## [5.0.1] - 2024-05-24

### Fixes

- Fix a possible refresh loop in the axios interceptor

## [5.0.0] - 2024-05-08

### Breaking changes

The `shouldDoInterceptionBasedOnUrl` function now returns true: 
- If `sessionTokenBackendDomain` is a valid subdomain of the URL's domain. This aligns with the behavior of browsers when sending cookies to subdomains.
- Even if the ports of the URL you are querying are different compared to the `apiDomain`'s port ot the `sessionTokenBackendDomain` port (as long as the hostname is the same, or a subdomain of the `sessionTokenBackendDomain`): https://github.com/supertokens/supertokens-website/issues/217

## [4.1.1] - 2024-03-14

- Support for new FDI version - 1.19
- Update test server to work with new node server versions

## [4.1.0] - 2024-01-03

- Added debug logs to the SDK
- Update contributing Prerequisites
- Remove unused ESLint and Prettier config files from TestingApp

## [4.0.8] - 2023-09-26
- use `URL` polyfill for `shouldDoInterceptionBasedOnUrl`: https://github.com/supertokens/supertokens-react-native/pull/111

## [4.0.7] - 2023-09-13

- Adds 1.18 to the list of FDI versions supported

## [4.0.6] - 2023-09-12

### Fixes

- Fixed an issue where refreshing tokens could hang while an interactive looping animation is running

## [4.0.5] - 2023-07-31

- Updates supported FDI versions to include 

## [4.0.4] - 2023-07-06

### Changes

- Added `shouldDoInterceptionBasedOnUrl` as an overrideable function to the recipe interface

### Fixes

- Fixed an issue where the Authorization header was getting removed unnecessarily

## [4.0.3] - 2023-06-06

- Refactors session logic to delete access token and refresh token if the front token is removed. This helps with proxies that strip headers with empty values which would result in the access token and refresh token to persist after signout

## [4.0.2] - 2023-05-22

- Adds a check to make sure `SuperTokens.init` is called when using functions exposed by the SDK

## [4.0.1] - 2023-05-03

- Adds tests based on changes in the session management logic in the backend SDKs and SuperTokens core

### Changes

- Adds dashboard to the with-thirdpartyemailpassword example app server

## [4.0.0] - 2023-01-30

### Breaking Changes

- The SDK now only supports FDI version 1.16
- The backend SDK should be updated to a version supporting the header-based sessions!
    -   supertokens-node: >= 13.0.0
    -   supertokens-python: >= 0.12.0
    -   supertokens-golang: >= 0.10.0
- Properties passed when calling SuperTokens.init have been renamed:
    - `cookieDomain` -> `sessionTokenBackendDomain`

### Added

- The SDK now supports managing sessions via headers (using `Authorization` bearer tokens) instead of cookies
- A new property has been added when calling SuperTokens.init: `tokenTransferMethod`. This can be used to configure whether the SDK should use cookies or headers for session management (`header` by default). Refer to https://supertokens.com/docs/thirdpartyemailpassword/common-customizations/sessions/token-transfer-method for more information

## [3.2.0] - 2022-09-17

### Changes

- Adds client id when initialising Google in the example app server
- Adds compatibility with FDI 1.15

## [3.1.0] - 2022-03-24
- Adds FDI 1.14 in FDI array support
- Checks for GENERAL_ERROR status in signout API response and if it's there, we throw an error.

## [3.0.7] - 2022-03-18

### Adds
- Adds FDI 1.12 in FDI array support
- Workflow to verify if pr title follows conventional commits

## [3.0.6] - 2022-01-13

### Adds
- Adds FDI 1.12 in FDI array support

## [3.0.5] - 2021-12-16

### Added
- Compatibility for FDI 1.11

## [3.0.4] - 2021-11-11
### Changed
- When calling a user's API, uses rid "anti-csrf" instead of session to solve https://github.com/supertokens/supertokens-node/issues/202

## [3.0.3] - 2021-11-09

### Added
- Supported FDI in frontendDriverSupported.json

## [3.0.2] - 2021-10-30

### Added
- FDI 1.10 support (just changing the frontendDriverInterfaceSupported.json)
- Adding bundle size checking as GitHub action and CI step

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

