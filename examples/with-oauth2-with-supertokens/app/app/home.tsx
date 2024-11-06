import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SuperTokens from "supertokens-react-native";
import { API_SERVER_URL } from "./index";
import { router } from 'expo-router';

export default function HomeScreen() {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [data, setData] = useState<string | undefined>(undefined);
  const insets = useSafeAreaInsets();

  const fetchUserId = async () => {
    const userId = await SuperTokens.getUserId();

    setUserId(userId);
  };

  const callAPI = async () => {
    try {
      const response = await fetch(API_SERVER_URL + "/sessioninfo");
      const data = await response.json();
      setData(JSON.stringify(data));
    } catch (_) {
      // no-op
    }
  };

  const signOut = async () => {
    await SuperTokens.signOut();
    router.replace("/");
  };

  useEffect(() => {
    fetchUserId();
  });

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 32,
        paddingLeft: insets.left + 32,
        paddingRight: insets.right + 32,
        backgroundColor: "#ddd",
      }}
    >
      <Pressable onPress={signOut} style={styles.signOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
      <View style={{ height: 16 }} />
      <View style={styles.contentContainer}>
        <View style={styles.contentHeader}>
          <Text style={styles.contentHeaderTitle}>Login successful</Text>
        </View>
        <View style={{ height: 24 }} />
        <Text>Your userID is:</Text>
        <View style={{ height: 6 }} />
        <View style={styles.userIdContainer}>
          <Text>{userId}</Text>
        </View>
        <View style={{ height: 16 }} />
        <Pressable onPress={callAPI} style={styles.callAPI}>
          <Text style={styles.buttonText}>Call API</Text>
        </Pressable>
        <View style={{ height: 24 }} />
      </View>
      <View style={{ height: 24 }} />
      {data !== undefined && (
        <View style={styles.dataContainer}>
          <Text>{data}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  signOut: {
    backgroundColor: "#f93",
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 8,
    display: "flex",
    alignSelf: "flex-end",
  },
  contentContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
  },
  contentHeader: {
    backgroundColor: "#e7ffed",
    padding: 12,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  contentHeaderTitle: {
    color: "#3eb655",
    fontWeight: "bold",
  },
  userIdContainer: {
    padding: 4,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#ff3f33",
    borderRadius: 4,
  },
  callAPI: {
    backgroundColor: "#f93",
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
  },
  dataContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    padding: 12,
    flex: 1,
  },
});