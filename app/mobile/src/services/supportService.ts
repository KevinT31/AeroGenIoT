import { Linking } from "react-native";
import { ENV } from "../config/env";
import { SupportContact } from "../types/aerogen";

const sanitizePhone = (value: string) => value.replace(/[^\d+]/g, "");

export const supportService = {
  getPrimaryContact(): SupportContact {
    return {
      phone: sanitizePhone(ENV.supportPhone),
      displayPhone: ENV.supportPhone,
    };
  },

  async callPrimaryContact() {
    const contact = this.getPrimaryContact();
    const url = `tel:${contact.phone}`;
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      return { ok: false as const, contact };
    }

    await Linking.openURL(url);
    return { ok: true as const, contact };
  },
};
