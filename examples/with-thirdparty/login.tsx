import { View, StyleSheet, Button, Platform } from "react-native";
import { performGoogleSignIn } from "./google";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { performGithubLogin } from "./github";
import { performAppleLogin } from "./apple";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export const LoginSreen = ({ navigation }: Props) => {
  const onGoogleClicked = async () => {
    const result = await performGoogleSignIn();

    if (result) {
      navigation.replace("Home");
    } else {
      navigation.replace("Splash");
    }
  };
  const onGithubClicked = async () => {
    const result = await performGithubLogin();

    if (result) {
      navigation.replace("Home");
    } else {
      navigation.replace("Splash");
    }
  };
  const onAppleClicked = async () => {
    const result = await performAppleLogin();

    if (result) {
      navigation.replace("Home");
    } else {
      navigation.replace("Splash");
    }
  };

  return (
    <View style={styles.container}>
      <Button onPress={onGoogleClicked} title="Continue with Google" />
      <View style={styles.spacer} />
      <Button onPress={onGithubClicked} title="Continue with Github" />
      <View style={styles.spacer} />
      {Platform.OS === "ios" && (
        <Button onPress={onAppleClicked} title="Continue with Apple" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 32,
    fontWeight: "bold",
  },
  spacer: {
    height: 16,
  },
});
