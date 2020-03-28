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

#import "RNSuperTokens.h"
#import "SuperTokensSession-Swift.h"

@implementation RNSuperTokens

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}
RCT_EXPORT_MODULE()


RCT_EXPORT_METHOD(initLib: (NSString *)refreshTokenEndpoint:
                  (int)sessionExpiryStatusCode:
                  (NSDictionary *)refreshAPICustomHeaders:
                  (RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSError *error = nil;
    [SuperTokens initialiseWithRefreshTokenEndpoint:refreshTokenEndpoint sessionExpiryStatusCode:sessionExpiryStatusCode refreshAPICustomHeaders:refreshAPICustomHeaders error:&error];
    
    if (error) {
        reject(@"init_failed", @"Call to initialising native SDK failed", error);
    } else {
        resolve(nil);
    }
}

RCT_EXPORT_METHOD(doesSessionExist:
                  (RCTPromiseResolveBlock)resolve:
                  (RCTPromiseRejectBlock)reject)
{
    NSNumber *result = [SuperTokens doesSessionExist] ? [NSNumber numberWithBool:YES] : [NSNumber numberWithBool:NO];
    resolve(result);
}

RCT_EXPORT_METHOD(dataTask:
                  (NSURLRequest *)request:
                  (RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    [SuperTokensURLSession
     dataTaskWithRequest:request
     completionHandler:^(NSData * data, NSURLResponse * response, NSError * error) {
        if (error) {
            reject(@"network_failed", @"Network request failed", error);
        } else {
            
        }
    }];
}

@end
  
