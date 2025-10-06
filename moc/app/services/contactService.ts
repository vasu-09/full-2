import type { Contact, PhoneNumber } from 'expo-contacts';

import apiClient from './apiClient';

export interface ContactMatch {
  userId: number;
  phone: string;
}

const normalizePhoneNumber = (value: string) => {
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

export const syncContacts = async (contacts: Contact[]): Promise<ContactMatch[]> => {
  const phones = collectPhoneNumbers(contacts);

  if (phones.length === 0) {
    return [];
  }

  const { data } = await apiClient.post<ContactMatch[]>('/contacts/sync', { phones });

  return Array.isArray(data) ? data : [];
};