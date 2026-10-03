import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { HeroBanner } from "../components/HeroBanner";
import { Panel } from "../components/Panel";
import { ScreenLayout } from "../components/ScreenLayout";
import { StatusTag } from "../components/StatusTag";
import { useAero } from "../state/AeroContext";
import { useSession } from "../state/SessionContext";
import { supportService } from "../services/supportService";
import { fonts, palette, radius, spacing } from "../theme";
import { UserProfile } from "../types/aerogen";

const legalCopy = {
  terms:
    "Aurora Noctua muestra informacion operativa del aerogenerador y alertas de apoyo. Las recomendaciones no reemplazan la inspeccion tecnica cuando exista riesgo electrico, mecanico o climatico.",
  privacy:
    "La app guarda tu sesion, perfil, dispositivo activo y ultimo estado para funcionar con mejor continuidad. Los eventos basicos de uso y errores se envian al backend solo para diagnostico del servicio.",
};

export const AccountScreen = () => {
  const {
    user,
    profile,
    devices,
    activeDeviceId,
    activeDeviceLabel,
    updateProfile,
    selectDevice,
    refreshDevices,
    logout,
    isWorking,
  } = useSession();
  const { syncState, isConnectedRealtime, lastError, usingCachedSnapshot } = useAero();
  const [draft, setDraft] = useState<UserProfile>(profile);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const save = async () => {
    await updateProfile(draft);
    Alert.alert("Perfil guardado", "Tu informacion quedo guardada en este telefono y en el backend.");
  };

  const callSupport = async () => {
    const result = await supportService.callPrimaryContact(draft.supportPhone || profile.supportPhone);
    if (!result.ok) {
      Alert.alert("Contacto", `No se pudo abrir llamada a ${result.contact.displayPhone}`);
    }
  };

  const openMail = async () => {
    const subject = encodeURIComponent("Soporte Aurora Noctua");
    const body = encodeURIComponent(`Usuario: ${user?.email || ""}\nDispositivo: ${activeDeviceId}\n`);
    await Linking.openURL(`mailto:soporte@auroranoctua2026.lat?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert("Contacto", "No se pudo abrir el correo en este dispositivo.");
    });
  };

  return (
    <ScreenLayout refreshing={isWorking} onRefresh={() => void refreshDevices()}>
      <HeroBanner icon="account-circle-outline" title="Cuenta" colors={["#0C5E8D", "#1998D0"]} />

      <Panel
        title={profile.displayName || user?.email || "Usuario"}
        subtitle={user?.email || "Sesion activa"}
        centerHeaderText
        rightSlot={<MaterialCommunityIcons name="shield-account-outline" size={22} color={palette.sky700} />}
      >
        <View style={styles.statusRow}>
          <StatusTag
            level={syncState === "live" ? "ok" : syncState === "stale" ? "warn" : "stop"}
            text={usingCachedSnapshot ? "Usando cache" : syncState}
          />
          <StatusTag level={isConnectedRealtime ? "ok" : "warn"} text={isConnectedRealtime ? "Realtime" : "Polling"} />
        </View>
        {lastError ? <Text style={styles.warnText}>Ultimo error: {lastError}</Text> : null}
      </Panel>

      <Panel
        title="Perfil"
        subtitle="Estos datos se conservan para soporte y contexto del operador."
        rightSlot={<MaterialCommunityIcons name="card-account-details-outline" size={22} color={palette.sky700} />}
      >
        <View style={styles.form}>
          <TextInput
            value={draft.displayName}
            onChangeText={(displayName) => setDraft((prev) => ({ ...prev, displayName }))}
            placeholder="Nombre visible"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
          />
          <TextInput
            value={draft.phone}
            onChangeText={(phone) => setDraft((prev) => ({ ...prev, phone }))}
            placeholder="Telefono"
            placeholderTextColor={palette.textMuted}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <TextInput
            value={draft.location}
            onChangeText={(location) => setDraft((prev) => ({ ...prev, location }))}
            placeholder="Ubicacion"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
          />
          <TextInput
            value={draft.organization}
            onChangeText={(organization) => setDraft((prev) => ({ ...prev, organization }))}
            placeholder="Finca / organizacion"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
          />
          <TextInput
            value={draft.supportPhone}
            onChangeText={(supportPhone) => setDraft((prev) => ({ ...prev, supportPhone }))}
            placeholder="Telefono de soporte"
            placeholderTextColor={palette.textMuted}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <Pressable style={styles.primaryBtn} onPress={() => void save()}>
            <Text style={styles.primaryText}>Guardar perfil</Text>
          </Pressable>
        </View>
      </Panel>

      <Panel
        title="Dispositivo activo"
        subtitle={`Actual: ${activeDeviceLabel}`}
        rightSlot={<MaterialCommunityIcons name="access-point" size={22} color={palette.sky700} />}
      >
        <View style={styles.deviceList}>
          {devices.map((device) => {
            const active = device.id === activeDeviceId;
            return (
              <Pressable
                key={device.id}
                onPress={() => void selectDevice(device.id)}
                style={[styles.deviceRow, active ? styles.deviceRowActive : null]}
              >
                <View style={styles.deviceCopy}>
                  <Text style={[styles.deviceName, active ? styles.deviceNameActive : null]}>{device.name || device.id}</Text>
                  <Text style={[styles.deviceId, active ? styles.deviceNameActive : null]}>{device.id}</Text>
                </View>
                <MaterialCommunityIcons
                  name={active ? "check-circle" : "circle-outline"}
                  size={22}
                  color={active ? "#FFFFFF" : palette.textMuted}
                />
              </Pressable>
            );
          })}
          <Pressable style={styles.secondaryBtn} onPress={() => void refreshDevices()}>
            <Text style={styles.secondaryText}>Actualizar lista</Text>
          </Pressable>
        </View>
      </Panel>

      <Panel
        title="Contacto"
        subtitle="Canales rapidos para soporte operativo."
        rightSlot={<MaterialCommunityIcons name="lifebuoy" size={22} color={palette.sky700} />}
      >
        <View style={styles.actions}>
          <Pressable style={styles.secondaryBtn} onPress={() => void callSupport()}>
            <Text style={styles.secondaryText}>Llamar soporte</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => void openMail()}>
            <Text style={styles.secondaryText}>Enviar correo</Text>
          </Pressable>
        </View>
      </Panel>

      <Panel
        title="Terminos y privacidad"
        subtitle="Resumen visible para uso piloto y APK interno."
        rightSlot={<MaterialCommunityIcons name="file-document-check-outline" size={22} color={palette.sky700} />}
      >
        <Text style={styles.legalTitle}>Terminos</Text>
        <Text style={styles.legalText}>{legalCopy.terms}</Text>
        <Text style={styles.legalTitle}>Privacidad</Text>
        <Text style={styles.legalText}>{legalCopy.privacy}</Text>
      </Panel>

      <Pressable style={styles.logoutBtn} onPress={() => void logout()}>
        <MaterialCommunityIcons name="logout" size={18} color={palette.danger} />
        <Text style={styles.logoutText}>Cerrar sesion</Text>
      </Pressable>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  statusRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  warnText: {
    marginTop: spacing.sm,
    color: palette.warn,
    fontFamily: fonts.bodySemi,
    textAlign: "center",
    lineHeight: 19,
  },
  form: {
    width: "100%",
    gap: spacing.sm,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  primaryBtn: {
    borderRadius: radius.md,
    backgroundColor: palette.sky700,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  primaryText: {
    color: "#FFFFFF",
    fontFamily: fonts.bodyBold,
  },
  deviceList: {
    width: "100%",
    gap: spacing.sm,
  },
  deviceRow: {
    width: "100%",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  deviceRowActive: {
    backgroundColor: palette.sky700,
    borderColor: palette.sky700,
  },
  deviceCopy: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    color: palette.text,
    fontFamily: fonts.bodyBold,
  },
  deviceNameActive: {
    color: "#FFFFFF",
  },
  deviceId: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
  },
  secondaryText: {
    color: palette.text,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    textAlign: "center",
  },
  legalTitle: {
    marginTop: spacing.sm,
    color: palette.text,
    fontFamily: fonts.bodyBold,
  },
  legalText: {
    color: palette.textSoft,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  logoutBtn: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#F2C8C8",
    backgroundColor: "#FFF7F7",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutText: {
    color: palette.danger,
    fontFamily: fonts.bodyBold,
  },
});
