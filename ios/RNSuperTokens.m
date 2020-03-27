
#import "RNSuperTokens.h"
#import "SuperTokensSession-Swift.h"

@implementation RNSuperTokens

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}
RCT_EXPORT_MODULE()

// refreshTokenEndpoint: String, sessionExpiryStatusCode: Int? = nil, refreshAPICustomHeaders: NSDictionary = NSDictionary()
RCT_EXPORT_METHOD(initLib)
{
    // SuperTokens.initialise();
}

@end
  
