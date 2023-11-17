import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import SuperTokens from "supertokens-react-native";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export const SplashScreen = ({ navigation }: Props) => {
  const checkSessionExists = async () => {
    const sessionExists = await SuperTokens.doesSessionExist();

    if (sessionExists) {
      navigation.replace("Home");
    } else {
      navigation.replace("Login");
    }
  };

  useEffect(() => {
    checkSessionExists();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>SuperTokens Example</Text>
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
});
