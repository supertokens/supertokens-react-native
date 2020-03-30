package com.example;

import android.app.Application;
import android.content.Context;

import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.modules.network.OkHttpClientProvider;
import com.facebook.react.modules.network.ReactCookieJarContainer;
import com.facebook.soloader.SoLoader;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.CookieHandler;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import okhttp3.Cookie;
import okhttp3.CookieJar;
import okhttp3.HttpUrl;
import okhttp3.JavaNetCookieJar;
import okhttp3.OkHttpClient;

public class MainApplication extends Application implements ReactApplication {

  private final ReactNativeHost mReactNativeHost =
      new ReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
          return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
          @SuppressWarnings("UnnecessaryLocalVariable")
          List<ReactPackage> packages = new PackageList(this).getPackages();
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // packages.add(new MyReactNativePackage());
          return packages;
        }

        @Override
        protected String getJSMainModuleName() {
          return "index";
        }
      };

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  @Override
  public void onCreate() {
    super.onCreate();
      // CODE USED TO FIX THE ISSUE OF DOMAIN NAME DURING DEVELOPMENT.
    fixCookieDomainIssue();
      // CODE USED TO FIX THE ISSUE OF DOMAIN NAME DURING DEVELOPMENT.
    SoLoader.init(this, /* native exopackage */ false);
    initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
  }

  /**
   * Loads Flipper in React Native templates. Call this in the onCreate method with something like
   * initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
   *
   * @param context
   * @param reactInstanceManager
   */
  private static void initializeFlipper(
      Context context, ReactInstanceManager reactInstanceManager) {
    if (BuildConfig.DEBUG) {
      try {
        /*
         We use reflection here to pick up the class that initializes Flipper,
        since Flipper library is not available in release mode
        */
        Class<?> aClass = Class.forName("com.example.ReactNativeFlipper");
        aClass
            .getMethod("initializeFlipper", Context.class, ReactInstanceManager.class)
            .invoke(null, context, reactInstanceManager);
      } catch (ClassNotFoundException e) {
        e.printStackTrace();
      } catch (NoSuchMethodException e) {
        e.printStackTrace();
      } catch (IllegalAccessException e) {
        e.printStackTrace();
      } catch (InvocationTargetException e) {
        e.printStackTrace();
      }
    }
  }

  // CODE USED TO FIX THE ISSUE OF DOMAIN NAME DURING DEVELOPMENT.
  private void fixCookieDomainIssue() {
      OkHttpClientProvider.setOkHttpClientFactory(() -> {
          OkHttpClient.Builder builder = OkHttpClientProvider.createClientBuilder(
                  mReactNativeHost.getReactInstanceManager().getCurrentReactContext());
          builder.cookieJar(new ReactCookieJarContainer() {

              @Override
              public void setCookieJar(CookieJar cookieJar) {
                  if (cookieJar instanceof JavaNetCookieJar) {
                      super.setCookieJar(new CustomJavaNetCookieJar((JavaNetCookieJar) cookieJar));
                  } else {
                      super.setCookieJar(cookieJar);
                  }
              }
          });
          return builder.build();
      });
  }

  private class CustomJavaNetCookieJar implements CookieJar {

      private final JavaNetCookieJar existing;

      public CustomJavaNetCookieJar(JavaNetCookieJar cookieJar) {
          existing = cookieJar;
      }

      @Override
      public void saveFromResponse(HttpUrl url, List<Cookie> cookies) {
          try {
              List<String> cookieStrings = new ArrayList<>();
              for (Cookie cookie : cookies) {
                  Method toStr = Cookie.class.getDeclaredMethod("toString");
                  toStr.setAccessible(true);
                  cookieStrings.add((String) toStr.invoke(cookie));
              }
              Map<String, List<String>> multimap = Collections.singletonMap("Set-Cookie", cookieStrings);

              Field field = existing.getClass().getDeclaredField("cookieHandler");
              field.setAccessible(true);
              CookieHandler cookieHandler = (CookieHandler) field.get(existing);
              cookieHandler.put(url.uri(), multimap);
              return;
          } catch (NoSuchMethodException e) {
          } catch (IllegalAccessException e) {
          } catch (InvocationTargetException e) {
          } catch (IllegalArgumentException e) {
          } catch (SecurityException e) {
          } catch (IOException e) {
          } catch (NoSuchFieldException e) {
          } catch (Throwable e) {}

          existing.saveFromResponse(url, cookies);
      }

      @Override
      public List<Cookie> loadForRequest(HttpUrl url) {
          return existing.loadForRequest(url);
      }
  }
    // CODE USED TO FIX THE ISSUE OF DOMAIN NAME DURING DEVELOPMENT.

}
