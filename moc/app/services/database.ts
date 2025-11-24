// eslint-disable-next-line import/no-unresolved
import * as SQLite from 'expo-sqlite';

export type ListRecordInput = {
  id: string;
  title: string;
  listType?: string | null;
  pinned?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdByUserId?: string | null;
};

export type ListItemRecordInput = {
  id?: string | number | null;
  itemName?: string | null;
  quantity?: string | null;
  priceText?: string | null;
  subQuantities?: { quantity?: string | null; priceText?: string | null }[] | null;
  subQuantitiesJson?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ListSummaryInput = ListRecordInput & {
  items?: ListItemRecordInput[];
};

type ListRow = {
  id: string;
  title: string;
  list_type: string | null;
  pinned: number;
  created_at: string | null;
  updated_at: string | null;
  created_by_user_id: string | null;
};

type ItemRow = {
  id: string;
  list_id: string;
  item_name: string;
  quantity: string | null;
  price_text: string | null;
  sub_quantities_json: string | null;
  created_at: string | null;
  updated_at: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let isInitialized = false;
let localItemCounter = 0;
let localContactCounter = 0;

const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('moc-app.db');
  }

  const db = await dbPromise;

  if (!isInitialized) {
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        list_type TEXT,
        pinned INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT,
        created_by_user_id TEXT
      );
    `);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS list_items (
        id TEXT PRIMARY KEY,
        list_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        quantity TEXT,
        price_text TEXT,
        sub_quantities_json TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY(list_id) REFERENCES lists(id) ON DELETE CASCADE
      );
    `);
     await db.execAsync(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone_numbers_json TEXT,
        image_uri TEXT,
        match_phone TEXT,
        match_user_id INTEGER,
        updated_at TEXT
      );
    `);
    isInitialized = true;
  }

  return db;
};

export const initializeDatabase = async (): Promise<void> => {
  await getDatabase();
};

const generateLocalItemId = (listId: string): string => {
  localItemCounter += 1;
  return `local-${listId}-${Date.now()}-${localItemCounter}`;
};

const parseSubQuantities = (value: string | null): { quantity?: string | null; priceText?: string | null }[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed as { quantity?: string | null; priceText?: string | null }[];
    }
  } catch (error) {
    console.warn('Failed to parse stored sub quantities', error);
  }

  return [];
};

const serializeSubQuantities = (
  input?: { quantity?: string | null; priceText?: string | null }[] | null,
  fallbackJson?: string | null,
): string | null => {
  if (Array.isArray(input)) {
    try {
      return JSON.stringify(input);
    } catch (error) {
      console.warn('Failed to serialize sub quantities', error);
      return fallbackJson ?? null;
    }
  }

  return fallbackJson ?? null;
};

const generateLocalContactId = (): string => {
  localContactCounter += 1;
  return `local-contact-${Date.now()}-${localContactCounter}`;
};

export type StoredContactInput = {
  id?: string | null;
  name: string;
  phoneNumbers?: { label?: string | null; number: string }[];
  imageUri?: string | null;
  matchPhone?: string | null;
  matchUserId?: number | null;
  updatedAt?: string | null;
};

type ContactRow = {
  id: string;
  name: string;
  phone_numbers_json: string | null;
  image_uri: string | null;
  match_phone: string | null;
  match_user_id: number | null;
  updated_at: string | null;
};


export const getListsFromDb = async (): Promise<{ id: string; title: string; listType: string | null; pinned: boolean; createdAt: string | null; updatedAt: string | null; createdByUserId: string | null }[]> => {
  const db = await getDatabase();
  const rows = (await db.getAllAsync<ListRow>('SELECT * FROM lists ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC, title COLLATE NOCASE ASC')) ?? [];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    listType: row.list_type,
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by_user_id,
  }));
};

export const replaceListsInDb = async (lists: ListRecordInput[]): Promise<void> => {
  const db = await getDatabase();

  await db.withExclusiveTransactionAsync(async (tx: SQLite.SQLiteDatabase) => {
    if (!lists.length) {
      await tx.runAsync('DELETE FROM list_items');
      await tx.runAsync('DELETE FROM lists');
      return;
    }

    const listIds = lists.map((list) => list.id);
    const placeholders = listIds.map(() => '?').join(',');

    await tx.runAsync(`DELETE FROM list_items WHERE list_id NOT IN (${placeholders})`, listIds);
    await tx.runAsync(`DELETE FROM lists WHERE id NOT IN (${placeholders})`, listIds);

    for (const list of lists) {
      const pinnedValue = list.pinned ? 1 : 0;
      await tx.runAsync(
        `INSERT INTO lists (id, title, list_type, pinned, created_at, updated_at, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           list_type = excluded.list_type,
           pinned = excluded.pinned,
           created_at = COALESCE(excluded.created_at, lists.created_at),
           updated_at = COALESCE(excluded.updated_at, lists.updated_at),
           created_by_user_id = COALESCE(excluded.created_by_user_id, lists.created_by_user_id)
        `,
        [
          list.id,
          list.title,
          list.listType ?? null,
          pinnedValue,
          list.createdAt ?? null,
          list.updatedAt ?? null,
          list.createdByUserId ?? null,
        ],
      );
    }
  });
};

export const updateListPinnedInDb = async (listIds: string[], pinned: boolean): Promise<void> => {
  if (!listIds.length) {
    return;
  }

  const db = await getDatabase();
  const placeholders = listIds.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE lists SET pinned = ? WHERE id IN (${placeholders})`,
    [pinned ? 1 : 0, ...listIds],
  );
};

export const deleteListsFromDb = async (listIds: string[]): Promise<void> => {
  if (!listIds.length) {
    return;
  }

  const db = await getDatabase();
  const placeholders = listIds.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM list_items WHERE list_id IN (${placeholders})`, listIds);
  await db.runAsync(`DELETE FROM lists WHERE id IN (${placeholders})`, listIds);
};

export const getListSummaryFromDb = async (
  listId: string,
): Promise<{
  id: string;
  title: string;
  listType: string | null;
  pinned: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  createdByUserId: string | null;
  items: {
    id: string;
    itemName: string;
    quantity: string | null;
    priceText: string | null;
    subQuantities: { quantity?: string | null; priceText?: string | null }[];
    createdAt: string | null;
    updatedAt: string | null;
  }[];
} | null> => {
  const db = await getDatabase();
  const listRow = await db.getFirstAsync<ListRow>('SELECT * FROM lists WHERE id = ?', [listId]);

  if (!listRow) {
    return null;
  }

  const itemRows = await db.getAllAsync<ItemRow>(
    'SELECT * FROM list_items WHERE list_id = ? ORDER BY COALESCE(updated_at, created_at) DESC, item_name COLLATE NOCASE ASC',
    [listId],
  );

  const items = itemRows?.map((row) => ({
    id: row.id,
    itemName: row.item_name,
    quantity: row.quantity,
    priceText: row.price_text,
    subQuantities: parseSubQuantities(row.sub_quantities_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) ?? [];

  return {
    id: listRow.id,
    title: listRow.title,
    listType: listRow.list_type,
    pinned: listRow.pinned === 1,
    createdAt: listRow.created_at,
    updatedAt: listRow.updated_at,
    createdByUserId: listRow.created_by_user_id,
    items,
  };
};

export const saveListSummaryToDb = async (summary: ListSummaryInput): Promise<void> => {
  if (!summary.id) {
    return;
  }

  const db = await getDatabase();
  const normalizedId = summary.id;

  await db.withExclusiveTransactionAsync(async (tx: SQLite.SQLiteDatabase) => {
    const existing = await tx.getFirstAsync<{ pinned: number }>('SELECT pinned FROM lists WHERE id = ?', [normalizedId]);
    const pinnedValue = summary.pinned != null ? (summary.pinned ? 1 : 0) : existing?.pinned ?? 0;

    await tx.runAsync(
      `INSERT INTO lists (id, title, list_type, pinned, created_at, updated_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         list_type = excluded.list_type,
         pinned = excluded.pinned,
         created_at = COALESCE(excluded.created_at, lists.created_at),
         updated_at = COALESCE(excluded.updated_at, lists.updated_at),
         created_by_user_id = COALESCE(excluded.created_by_user_id, lists.created_by_user_id)
      `,
      [
        normalizedId,
        summary.title,
        summary.listType ?? null,
        pinnedValue,
        summary.createdAt ?? null,
        summary.updatedAt ?? null,
        summary.createdByUserId ?? null,
      ],
    );

    if (summary.items) {
      await tx.runAsync('DELETE FROM list_items WHERE list_id = ?', [normalizedId]);

      for (const item of summary.items) {
        const itemId = item.id != null ? String(item.id) : generateLocalItemId(normalizedId);
        const json = serializeSubQuantities(item.subQuantities ?? null, item.subQuantitiesJson ?? null);
        await tx.runAsync(
          `INSERT INTO list_items (id, list_id, item_name, quantity, price_text, sub_quantities_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             item_name = excluded.item_name,
             quantity = excluded.quantity,
             price_text = excluded.price_text,
             sub_quantities_json = excluded.sub_quantities_json,
             created_at = COALESCE(excluded.created_at, list_items.created_at),
             updated_at = COALESCE(excluded.updated_at, list_items.updated_at)
          `,
          [
            itemId,
            normalizedId,
            item.itemName ?? 'Untitled Item',
            item.quantity ?? null,
            item.priceText ?? null,
            json,
            item.createdAt ?? null,
            item.updatedAt ?? null,
          ],
        );
      }
    }
  });
};

export const replaceContactsInDb = async (contacts: StoredContactInput[]): Promise<void> => {
  const db = await getDatabase();

  await db.withExclusiveTransactionAsync(async (tx: SQLite.SQLiteDatabase) => {
    await tx.runAsync('DELETE FROM contacts');

    for (const contact of contacts) {
      const normalizedId = contact.id ? String(contact.id) : generateLocalContactId();
      let phoneJson: string | null = null;

      if (Array.isArray(contact.phoneNumbers)) {
        try {
          const cleaned = contact.phoneNumbers
            .filter((entry) => Boolean(entry?.number))
            .map((entry) => ({
              number: entry?.number ?? '',
              label: entry?.label ?? null,
            }));
          phoneJson = cleaned.length ? JSON.stringify(cleaned) : null;
        } catch (error) {
          console.warn('Unable to serialize phone numbers for contact', contact?.id ?? contact?.name, error);
          phoneJson = null;
        }
      }

      await tx.runAsync(
        `INSERT INTO contacts (id, name, phone_numbers_json, image_uri, match_phone, match_user_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           phone_numbers_json = excluded.phone_numbers_json,
           image_uri = excluded.image_uri,
           match_phone = excluded.match_phone,
           match_user_id = excluded.match_user_id,
           updated_at = COALESCE(excluded.updated_at, contacts.updated_at)
        `,
        [
          normalizedId,
          contact.name,
          phoneJson,
          contact.imageUri ?? null,
          contact.matchPhone ?? null,
          contact.matchUserId ?? null,
          contact.updatedAt ?? new Date().toISOString(),
        ],
      );
    }
  });
};

export const getContactsFromDb = async (): Promise<StoredContactInput[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ContactRow>('SELECT * FROM contacts ORDER BY name COLLATE NOCASE ASC');

  return (
    rows?.map((row) => {
      let phoneNumbers: { label?: string | null; number: string }[] | undefined;

      if (row.phone_numbers_json) {
        try {
          const parsed = JSON.parse(row.phone_numbers_json);
          if (Array.isArray(parsed)) {
            phoneNumbers = parsed
              .filter((entry) => Boolean(entry?.number))
              .map((entry) => ({ number: String(entry.number), label: entry?.label ?? null }));
          }
        } catch (error) {
          console.warn('Unable to parse stored phone numbers for contact', row.id, error);
        }
      }

      return {
        id: row.id,
        name: row.name,
        phoneNumbers,
        imageUri: row.image_uri,
        matchPhone: row.match_phone,
        matchUserId: row.match_user_id,
        updatedAt: row.updated_at,
      } as StoredContactInput;
    }) ?? []
  );
};