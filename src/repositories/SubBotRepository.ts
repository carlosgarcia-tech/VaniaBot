/**
 * SubBotRepository.ts
 *
 * Repository for subbot data (mirrors subbot_slots for compatibility).
 *
 * @author Carlos G
 * @created 2026-04-07
 */

import { getDatabase } from './Database.js';

export interface SubBotRecord {
  id: string;
  phone_number: string;
  display_name: string | null;
  role: string;
  status: string;
  enabled: number;
  owner_jid: string | null;
  owner_name: string | null;
  session_path: string | null;
  prefix: string;
  slot_number: number | null;
  bio: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  autostart?: number;
  safe_mode?: number;
  safe_mode_reason?: string | null;
  feature_flags?: string | null;
  safe_mode_backup_flags?: string | null;
}

export interface CreateSubBotInput {
  id: string;
  phone_number: string;
  display_name?: string;
  role?: string;
  owner_jid?: string;
  owner_name?: string;
  session_path?: string;
  prefix?: string;
  slot_number?: number;
  bio?: string;
  photo_url?: string;
}

export interface UpdateSubBotInput {
  phone_number?: string;
  display_name?: string;
  status?: string;
  enabled?: number;
  owner_jid?: string;
  owner_name?: string;
  session_path?: string;
  prefix?: string;
  slot_number?: number;
  bio?: string;
  photo_url?: string;
}

export class SubBotRepository {
  private static instance: SubBotRepository;

  private constructor() {}

  static getInstance(): SubBotRepository {
    if (!SubBotRepository.instance) {
      SubBotRepository.instance = new SubBotRepository();
    }
    return SubBotRepository.instance;
  }

  findAll(): SubBotRecord[] {
    return getDatabase().fetchAll<SubBotRecord>('SELECT * FROM subbots ORDER BY created_at DESC');
  }

  findById(id: string): SubBotRecord | null {
    return getDatabase().fetchOne<SubBotRecord>('SELECT * FROM subbots WHERE id = ?', {
      params: [id],
    });
  }

  findByPhoneNumber(phoneNumber: string): SubBotRecord | null {
    return getDatabase().fetchOne<SubBotRecord>('SELECT * FROM subbots WHERE phone_number = ?', {
      params: [phoneNumber],
    });
  }

  create(input: CreateSubBotInput): SubBotRecord {
    const now = new Date().toISOString();

    getDatabase().query(
      `INSERT INTO subbots (
        id, phone_number, display_name, role, status, enabled,
        owner_jid, owner_name, session_path, prefix, slot_number,
        bio, photo_url, created_at, updated_at, autostart, safe_mode, feature_flags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        params: [
          input.id,
          input.phone_number,
          input.display_name ?? null,
          input.role ?? 'subbot',
          'pending',
          1,
          input.owner_jid ?? null,
          input.owner_name ?? null,
          input.session_path ?? null,
          input.prefix ?? '.',
          input.slot_number ?? null,
          input.bio ?? null,
          input.photo_url ?? null,
          now,
          now,
          1,
          0,
          '{"ai":true,"downloads":true,"heavyMedia":true,"games":true,"moderation":true,"adminCommands":true}',
        ],
      },
    );

    const record = this.findById(input.id);
    if (!record) throw new Error(`Failed to create subbot: ${input.id}`);
    return record;
  }

  update(id: string, updates: UpdateSubBotInput): SubBotRecord | null {
    const sets: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [new Date().toISOString()];

    if (updates.phone_number !== undefined) {
      sets.push('phone_number = ?');
      params.push(updates.phone_number);
    }
    if (updates.display_name !== undefined) {
      sets.push('display_name = ?');
      params.push(updates.display_name);
    }
    if (updates.status !== undefined) {
      sets.push('status = ?');
      params.push(updates.status);
    }
    if (updates.enabled !== undefined) {
      sets.push('enabled = ?');
      params.push(updates.enabled);
    }
    if (updates.owner_jid !== undefined) {
      sets.push('owner_jid = ?');
      params.push(updates.owner_jid);
    }
    if (updates.owner_name !== undefined) {
      sets.push('owner_name = ?');
      params.push(updates.owner_name);
    }
    if (updates.session_path !== undefined) {
      sets.push('session_path = ?');
      params.push(updates.session_path);
    }
    if (updates.prefix !== undefined) {
      sets.push('prefix = ?');
      params.push(updates.prefix);
    }
    if (updates.slot_number !== undefined) {
      sets.push('slot_number = ?');
      params.push(updates.slot_number);
    }
    if (updates.bio !== undefined) {
      sets.push('bio = ?');
      params.push(updates.bio);
    }
    if (updates.photo_url !== undefined) {
      sets.push('photo_url = ?');
      params.push(updates.photo_url);
    }

    params.push(id);

    getDatabase().query(`UPDATE subbots SET ${sets.join(', ')} WHERE id = ?`, { params });

    return this.findById(id);
  }

  delete(id: string): boolean {
    const before = this.findById(id);
    if (!before) return false;

    getDatabase().query('DELETE FROM subbots WHERE id = ?', { params: [id] });
    return true;
  }
}

export const subBotRepository = SubBotRepository.getInstance();
