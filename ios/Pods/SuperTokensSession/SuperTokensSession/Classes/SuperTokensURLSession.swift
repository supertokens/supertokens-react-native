/* Copyright (c) 2020, VRAI Labs and/or its affiliates. All rights reserved.
 *
 * This software is licensed under the Apache License, Version 2.0 (the
 * "License") as published by the Apache Software Foundation.
 *
 * You may not use this file except in compliance with the License. You may
 * obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */

import Foundation

public class SuperTokensURLSession {
    private static let readWriteDispatchQueue = DispatchQueue(label: "io.supertokens.session.readwrite", attributes: .concurrent)
    
    public static func dataTask(request: URLRequest, completionHandler: @escaping (Data?, URLResponse?, Error?) -> Void) {
        if !SuperTokens.isInitCalled {
            completionHandler(nil, nil, SuperTokensError.illegalAccess("SuperTokens.init must be called before calling SuperTokensURLSession.newTask"))
            return
        }
        
        // we have a read write lock here. We take a read lock while making a request and a write lock while refreshing
        // because if we dno't do that, then there may be a race condition where we may read a new id refresh token from storage
        // but the cookies may still be the older ones.
        readWriteDispatchQueue.async {
            makeRequest(request: request, completionHandler: completionHandler)
        }
        
    }
    
    private static func makeRequest(request: URLRequest, completionHandler: @escaping (Data?, URLResponse?, Error?) -> Void) {
        let mutableRequest = (request as NSURLRequest).mutableCopy() as! NSMutableURLRequest
        let preRequestIdRefresh = IdRefreshToken.getToken()
        let antiCSRF = AntiCSRF.getToken(associatedIdRefreshToken: preRequestIdRefresh)
        if antiCSRF != nil {
            mutableRequest.addValue(antiCSRF!, forHTTPHeaderField: SuperTokensConstants.antiCSRFHeaderKey)
        }
        
        // Add package info to headers
        if preRequestIdRefresh != nil {
            mutableRequest.addValue(SuperTokensConstants.platformName, forHTTPHeaderField: SuperTokensConstants.nameHeaderKey)
            mutableRequest.addValue(SuperTokensConstants.sdkVersion, forHTTPHeaderField: SuperTokensConstants.versionHeaderKey)
        }
        let apiRequest = mutableRequest.copy() as! URLRequest
        let apiTask = URLSession.shared.dataTask(with: apiRequest, completionHandler: { data, response, httpError in
            if response as? HTTPURLResponse != nil {
                let httpResponse = response as! HTTPURLResponse
                let headerFields = httpResponse.allHeaderFields as? [String:String]
                if headerFields != nil && response!.url != nil {
                    let idRefreshTokenFromResponse = httpResponse.allHeaderFields[SuperTokensConstants.idRefreshTokenHeaderKey]
                    if (idRefreshTokenFromResponse != nil) {
                        IdRefreshToken.setToken(newIdRefreshToken: idRefreshTokenFromResponse as! String);
                    }
                }
                if httpResponse.statusCode == SuperTokens.sessionExpiryStatusCode {
                    handleUnauthorised(preRequestIdRefresh: preRequestIdRefresh, retryCallback: { shouldRetry, error in
                        // NOTE: this will run in delegate queue of URLSession.dataTask
                        if error != nil {
                            if IdRefreshToken.getToken() == nil {
                                AntiCSRF.removeToken()
                            }
                            completionHandler(nil, nil, error)
                            return
                        }
                        
                        if shouldRetry {
                            readWriteDispatchQueue.async {
                                makeRequest(request: request, completionHandler: completionHandler)
                            }
                        } else {
                            if IdRefreshToken.getToken() == nil {
                                AntiCSRF.removeToken()
                            }
                            completionHandler(data, response, error)
                        }
                    })
                } else {
                    let antiCSRFFromResponse = httpResponse.allHeaderFields[SuperTokensConstants.antiCSRFHeaderKey]
                    if antiCSRFFromResponse != nil {
                        let idRefreshPostResponse = IdRefreshToken.getToken()
                        AntiCSRF.setToken(antiCSRFToken: antiCSRFFromResponse as! String, associatedIdRefreshToken: idRefreshPostResponse)
                    }
                    if IdRefreshToken.getToken() == nil {
                        AntiCSRF.removeToken()
                    }
                    completionHandler(data, response, httpError)
                }
            } else {
                if IdRefreshToken.getToken() == nil {
                    AntiCSRF.removeToken()
                }
                completionHandler(data, response, httpError)
            }
        })
        apiTask.resume()
        
        // TODO: ideally we would like to return apiTask itself.. as that is what is expected from the user.
        
        // we are not using semaphors here to wait for the response from the request because we do not need to have a lock after the request has returned.. just before the request is made. This is because in refresh API, setting of cookies and idRefreshToken happen differently.. so a request may to go with new idRefreshToken, but old cookies yielding session expired, causing another call to refresh API
    }
    
    private static func handleUnauthorised(preRequestIdRefresh: String?, retryCallback: @escaping (Bool, Error?) -> Void) {
        // running in delegate queue of URLSession.dataTask
        if preRequestIdRefresh == nil {
            let idRefreshFromStorage = IdRefreshToken.getToken()
            retryCallback(idRefreshFromStorage != nil, nil)
            return
        }
        
        onUnauthorisedResponse(refreshTokenEndpoint: SuperTokens.refreshTokenEndpoint!, preRequestIdRefresh: preRequestIdRefresh!, unauthorisedCallback: {
            unauthorisedResponse in
            // this is happening in the delegate queue of URLSession.dataTash API
            if unauthorisedResponse.status == UnauthorisedResponse.UnauthorisedStatus.SESSION_EXPIRED {
                retryCallback(false, nil)
                return
            } else if unauthorisedResponse.status == UnauthorisedResponse.UnauthorisedStatus.API_ERROR {
                retryCallback(false, unauthorisedResponse.error)
                return
            }
            retryCallback(true, nil)
        })
    }
    
    private static func onUnauthorisedResponse(refreshTokenEndpoint: String, preRequestIdRefresh: String, unauthorisedCallback: @escaping (UnauthorisedResponse) -> Void) {
        readWriteDispatchQueue.async(flags: .barrier) {
            let postLockIdRefresh = IdRefreshToken.getToken()
            if postLockIdRefresh == nil {
                unauthorisedCallback(UnauthorisedResponse(status: UnauthorisedResponse.UnauthorisedStatus.SESSION_EXPIRED))
                return
            }
            
            if postLockIdRefresh != preRequestIdRefresh {
                unauthorisedCallback(UnauthorisedResponse(status: UnauthorisedResponse.UnauthorisedStatus.RETRY))
                return;
            }
            
            let refreshUrl = URL(string: refreshTokenEndpoint)!
            var refreshRequest = URLRequest(url: refreshUrl)
            refreshRequest.httpMethod = "POST"
            
            // Add package info to headers
            refreshRequest.addValue(SuperTokensConstants.platformName, forHTTPHeaderField: SuperTokensConstants.nameHeaderKey)
            refreshRequest.addValue(SuperTokensConstants.sdkVersion, forHTTPHeaderField: SuperTokensConstants.versionHeaderKey)
            for (headerKey, headerValue) in SuperTokens.refreshAPICustomHeaders {
                if let val = headerValue as? String, let key = headerKey as? String {
                    refreshRequest.addValue(val, forHTTPHeaderField: key)
                }
            }
            
            let semaphore = DispatchSemaphore(value: 0)
            
            let refreshTask = URLSession.shared.dataTask(with: refreshRequest, completionHandler: { data, response, error in
                
                if response as? HTTPURLResponse != nil {
                    let httpResponse = response as! HTTPURLResponse
                    let headerFields = httpResponse.allHeaderFields as? [String:String]
                    
                    var removeIdRefreshToken = true;
                    if headerFields != nil && response!.url != nil {
                        let idRefreshTokenFromResponse = httpResponse.allHeaderFields[SuperTokensConstants.idRefreshTokenHeaderKey]
                        if (idRefreshTokenFromResponse != nil) {
                            IdRefreshToken.setToken(newIdRefreshToken: idRefreshTokenFromResponse as! String);
                            removeIdRefreshToken = false;
                        }
                    }
                    
                    if httpResponse.statusCode == SuperTokens.sessionExpiryStatusCode && removeIdRefreshToken {
                        IdRefreshToken.setToken(newIdRefreshToken: "remove");
                    }
                    
                    if httpResponse.statusCode != 200 {
                        semaphore.signal()
                        unauthorisedCallback(UnauthorisedResponse(status: UnauthorisedResponse.UnauthorisedStatus.API_ERROR, error: SuperTokensError.apiError("Refresh API returned with status code: \(httpResponse.statusCode)")))
                        return
                    }
                    
                    let idRefreshToken = IdRefreshToken.getToken()
                    if idRefreshToken == nil {
                        semaphore.signal()
                        unauthorisedCallback(UnauthorisedResponse(status: UnauthorisedResponse.UnauthorisedStatus.SESSION_EXPIRED))
                        return
                    }
                    
                    let antiCSRFFromResponse = httpResponse.allHeaderFields[SuperTokensConstants.antiCSRFHeaderKey]
                    if antiCSRFFromResponse != nil {
                        AntiCSRF.setToken(antiCSRFToken: antiCSRFFromResponse as! String, associatedIdRefreshToken: idRefreshToken)
                    }
                    semaphore.signal()
                    unauthorisedCallback(UnauthorisedResponse(status: UnauthorisedResponse.UnauthorisedStatus.RETRY))
                } else {
                    semaphore.signal()
                    unauthorisedCallback(UnauthorisedResponse(status: UnauthorisedResponse.UnauthorisedStatus.API_ERROR, error: error))
                }
            })
            refreshTask.resume()
            semaphore.wait()    // this is there so that this function call waits for the callback to exeicute so that we still have the write lock on our queue.
        }
    }
    
    
//    public static func attemptRefreshingSession(completionHandler: @escaping (Bool, Error?) -> Void) {
//        if !SuperTokens.isInitCalled {
//            completionHandler(false, SuperTokensError.illegalAccess("SuperTokens.init must be called before calling SuperTokensURLSession.attemptRefreshingSession"))
//            return
//        }
//
//        readWriteDispatchQueue.async {
//            let preRequestIdRefresh = IdRefreshToken.getToken()
//            handleUnauthorised(preRequestIdRefresh: preRequestIdRefresh, retryCallback: {
//                result, error in
//
//                if IdRefreshToken.getToken() == nil {
//                    AntiCSRF.removeToken()
//                }
//
//                if error != nil {
//                    completionHandler(false, error!)
//                    return
//                }
//
//                completionHandler(result, nil)
//            })
//        }
//    }
}
