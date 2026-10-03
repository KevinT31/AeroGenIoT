import { Linking } from "react-native";
import { ENV } from "../config/env";
import { SupportContact } from "../types/aerogen";

const sanitizePhone = (value: string) => value.replace(/[^\d+]/g, "");

export const supportService = {
  getPrimaryContact(phoneOverride?: string): SupportContact {
    const phone = phoneOverride || ENV.supportPhone;
    return {
      phone: sanitizePhone(phone),
      displayPhone: phone,
    };
  },

  async callPrimaryContact(phoneOverride?: string) {
    const contact = this.getPrimaryContact(phoneOverride);
    const url = `tel:${contact.phone}`;
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      return { ok: false as const, contact };
    }

    await Linking.openURL(url);
    return { ok: true as const, contact };
  },
};
