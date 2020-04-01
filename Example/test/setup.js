import MockStorage from "./asyncStorage";

jest.mock("react-native", () => {
    return {
        AsyncStorage: new MockStorage({})
    };
});
