import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSession } from "../state/SessionContext";
import { fonts, palette, radius, shadows, spacing } from "../theme";

export const AuthScreen = () => {
  const { login, register, isWorking, sessionError, clearSessionError } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async () => {
    clearSessionError();
    if (mode === "register") {
      await register(name, email, password);
      return;
    }
    await login(email, password);
  };

  const canSubmit =
    email.trim().includes("@") &&
    password.length >= 6 &&
    (mode === "login" || name.trim().length >= 2);

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={["#0B6E99", "#16A6DB"]} style={styles.hero}>
        <View style={styles.brandIcon}>
          <MaterialCommunityIcons name="fan" size={30} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Aurora Noctua</Text>
        <Text style={styles.subtitle}>Acceso seguro al monitoreo del aerogenerador.</Text>
      </LinearGradient>

      <View style={styles.card}>
        <View style={styles.segment}>
          <Pressable
            style={[styles.segmentBtn, mode === "login" ? styles.segmentActive : null]}
            onPress={() => setMode("login")}
          >
            <Text style={[styles.segmentText, mode === "login" ? styles.segmentTextActive : null]}>Ingresar</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, mode === "register" ? styles.segmentActive : null]}
            onPress={() => setMode("register")}
          >
            <Text style={[styles.segmentText, mode === "register" ? styles.segmentTextActive : null]}>Crear cuenta</Text>
          </Pressable>
        </View>

        {mode === "register" ? (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nombre"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
            autoCapitalize="words"
            editable={!isWorking}
          />
        ) : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Correo"
          placeholderTextColor={palette.textMuted}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!isWorking}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Clave"
          placeholderTextColor={palette.textMuted}
          style={styles.input}
          secureTextEntry
          textContentType={mode === "login" ? "password" : "newPassword"}
          editable={!isWorking}
        />

        {sessionError ? <Text style={styles.error}>{sessionError}</Text> : null}

        <Pressable
          onPress={() => void submit()}
          disabled={!canSubmit || isWorking}
          style={[styles.primaryBtn, !canSubmit || isWorking ? styles.disabled : null]}
        >
          {isWorking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>{mode === "login" ? "Entrar" : "Crear y entrar"}</Text>
          )}
        </Pressable>

        <Text style={styles.legal}>
          Al continuar aceptas los terminos de uso y la politica de privacidad incluidos en la app.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: palette.background,
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    ...shadows.card,
  },
  brandIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  title: {
    color: "#FFFFFF",
    fontFamily: fonts.title,
    fontSize: 28,
    textAlign: "center",
  },
  subtitle: {
    color: "#EAF7FF",
    fontFamily: fonts.body,
    lineHeight: 20,
    textAlign: "center",
  },
  card: {
    borderRadius: radius.xl,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  segment: {
    flexDirection: "row",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: palette.sky700,
  },
  segmentText: {
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  error: {
    color: palette.danger,
    fontFamily: fonts.bodySemi,
    lineHeight: 20,
    textAlign: "center",
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: palette.sky700,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.55,
  },
  primaryText: {
    color: "#FFFFFF",
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  legal: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
