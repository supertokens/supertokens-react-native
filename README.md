
![SuperTokens banner](https://raw.githubusercontent.com/supertokens/supertokens-logo/master/images/Artboard%20%E2%80%93%2027%402x.png)

# SuperTokens React Native SDK

<a href="https://supertokens.io/discord">
<img src="https://img.shields.io/discord/603466164219281420.svg?logo=discord"
    alt="chat on Discord"></a>
    
## About
This is a react native SDK that is responsible for maintaining a SuperTokens session for mobile apps.

Learn more at https://supertokens.io

## Documentation
To see documentation, please click [here](https://supertokens.io/docs/react-native/installation).

## Making changes
Please see our [Contributing](https://github.com/supertokens/supertokens-react-native/blob/master/CONTRIBUTING.md) guide.

## Contact us
For any queries, or support requests, please email us at team@supertokens.io, or join our [Discord](supertokens.io/discord) server.

## Authors
Created with :heart: by the folks at SuperTokens.io.



---------------------------------

## Getting started

`$ npm install react-native-lib --save`

### Mostly automatic installation

`$ react-native link react-native-lib`

### Manual installation


#### iOS

1. In XCode, in the project navigator, right click `Libraries` ➜ `Add Files to [your project's name]`
2. Go to `node_modules` ➜ `react-native-lib` and add `RNSuperTokens.xcodeproj`
3. In XCode, in the project navigator, select your project. Add `libRNSuperTokens.a` to your project's `Build Phases` ➜ `Link Binary With Libraries`
4. Run your project (`Cmd+R`)<

#### Android

1. Open up `android/app/src/main/java/[...]/MainActivity.java`
  - Add `import io.supertokens.reactnative.RNSuperTokensPackage;` to the imports at the top of the file
  - Add `new RNSuperTokensPackage()` to the list returned by the `getPackages()` method
2. Append the following lines to `android/settings.gradle`:
  	```
  	include ':react-native-lib'
  	project(':react-native-lib').projectDir = new File(rootProject.projectDir, 	'../node_modules/react-native-lib/android')
  	```
3. Insert the following lines inside the dependencies block in `android/app/build.gradle`:
  	```
      compile project(':react-native-lib')
  	```

#### Windows
[Read it! :D](https://github.com/ReactWindows/react-native)

1. In Visual Studio add the `RNSuperTokens.sln` in `node_modules/react-native-lib/windows/RNSuperTokens.sln` folder to their solution, reference from their app.
2. Open up your `MainPage.cs` app
  - Add `using Lib.RNSuperTokens;` to the usings at the top of the file
  - Add `new RNSuperTokensPackage()` to the `List<IReactPackage>` returned by the `Packages` method


## Usage
```javascript
import RNSuperTokens from 'react-native-lib';

// TODO: What to do with the module?
RNSuperTokens;
```
  