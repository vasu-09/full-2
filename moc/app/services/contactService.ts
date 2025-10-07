import type { Contact, PhoneNumber } from 'expo-contacts';

import apiClient from './apiClient';

export interface ContactMatch {
  userId: number;
  phone: string;
}

export interface ContactDetails {
  name: string;
  imageUri?: string | null;
}

export const normalizePhoneNumber = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let sanitized = trimmed.replace(/[^\d+]/g, '');

  if (sanitized.startsWith('00')) {
    sanitized = `+${sanitized.slice(2)}`;
  }

  if (!sanitized.startsWith('+') && sanitized.length >= 10) {
    sanitized = `+${sanitized}`;
  }

  if (sanitized.length < 6) {
    return null;
  }

  return sanitized;
};

const collectPhoneNumbers = (contacts: Contact[]): string[] => {
  const numbers = new Set<string>();

  contacts.forEach((contact) => {
    (contact.phoneNumbers ?? []).forEach((phone: PhoneNumber) => {
      const normalized = phone?.number ? normalizePhoneNumber(phone.number) : null;
      if (normalized) {
        numbers.add(normalized);
      }
    });
  });

  return Array.from(numbers);
};

export const buildContactIndex = (contacts: Contact[]): Map<string, ContactDetails> => {
  const index = new Map<string, ContactDetails>();

  contacts.forEach((contact) => {
    (contact.phoneNumbers ?? []).forEach((phone: PhoneNumber) => {
      const normalized = phone?.number ? normalizePhoneNumber(phone.number) : null;
      if (!normalized || index.has(normalized)) {
        return;
      }

      index.set(normalized, {
        name: contact?.name?.trim() || normalized,
        imageUri: contact?.imageAvailable ? contact?.image?.uri ?? null : null,
      });
    });
  });

  return index;
};


export const syncContacts = async (contacts: Contact[]): Promise<ContactMatch[]> => {
  const phones = collectPhoneNumbers(contacts);

  if (phones.length === 0) {
    return [];
  }

  const { data } = await apiClient.post<ContactMatch[]>('/contacts/sync', { phones });

  return Array.isArray(data) ? data : [];
};