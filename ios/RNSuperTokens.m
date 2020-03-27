
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
        reject(@"no_events", @"There were no events", error);
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

@end
  
