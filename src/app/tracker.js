// Application state: an in-memory copy of the database with write-through persistence.
// The UI reads from here and calls these methods; it never touches IndexedDB directly.
import * as repo from '../data/repository.js';

const STORES = ['habits', 'entries', 'days', 'meta'];
import { todayKey } from '../domain/dates.js';
import { starterHabits, createHabit, entryKey, charretteDaySet } from '../domain/habits.js';

const EXPORT_FORMAT = 'studio-days/1';

export class Tracker {
  #habits = new Map();
  #entries = new Map();
  #days = new Map();
  #meta = new Map();
  #listeners = new Set();

  async load() {
    const data = await repo.loadAll();
    this.#hydrate(data);
    if (!this.#meta.get('seeded')) {
      for (const h of starterHabits(todayKey())) await this.#saveHabit(h);
      await this.#setMeta('seeded', true);
    }
  }

  onChange(fn) { this.#listeners.add(fn); }
  #emit() { for (const fn of this.#listeners) fn(); }

  // ---- habits
  habits({ includeArchived = false } = {}) {
    return [...this.#habits.values()]
      .filter((h) => includeArchived || !h.archived)
      .sort((a, b) => a.order - b.order);
  }
  habit(id) { return this.#habits.get(id); }

  async addHabit(fields) {
    const order = Math.max(-1, ...this.habits({ includeArchived: true }).map((h) => h.order)) + 1;
    await this.#saveHabit(createHabit({ ...fields, order, createdOn: todayKey() }));
    this.#emit();
  }

  async updateHabit(id, fields) {
    const h = { ...this.#habits.get(id), ...fields };
    if (h.kind === 'check') h.target = 1;
    await this.#saveHabit(h);
    this.#emit();
  }

  async deleteHabit(id) {
    this.#habits.delete(id);
    await repo.remove('habits', id);
    for (const key of [...this.#entries.keys()]) {
      if (key.startsWith(`${id}|`)) { this.#entries.delete(key); await repo.remove('entries', key); }
    }
    this.#emit();
  }

  // ---- daily values
  valueOf = (habitId, day) => this.#entries.get(entryKey(habitId, day)) ?? 0;

  async setValue(habitId, day, value) {
    const key = entryKey(habitId, day);
    const v = Math.max(0, Math.round(value));
    if (v === 0) { this.#entries.delete(key); await repo.remove('entries', key); }
    else { this.#entries.set(key, v); await repo.put('entries', { key, value: v }); }
    this.#emit();
  }

  /** All-time number of habit-days that met their target. */
  totalCheckIns() {
    let n = 0;
    for (const [key, value] of this.#entries) {
      const h = this.#habits.get(key.split('|')[0]);
      if (h && value >= h.target) n += 1;
    }
    return n;
  }

  // ---- day notes (the one design priority)
  note(day) { return this.#days.get(day)?.note ?? ''; }
  async setNote(day, note) {
    const rec = { ...(this.#days.get(day) ?? { date: day }), note };
    this.#days.set(day, rec);
    await repo.put('days', rec);
  }

  // ---- mood & energy check-in (1–5), stored on the day record
  mood(day) { return this.#days.get(day)?.mood ?? 0; }
  async setMood(day, mood) {
    const rec = { ...(this.#days.get(day) ?? { date: day }), mood };
    this.#days.set(day, rec);
    await repo.put('days', rec);
    this.#emit();
  }

  /** Is a habit with this name already active? (used by the library sheet) */
  hasHabitNamed(name) { return this.habits().some((h) => h.name.toLowerCase() === name.toLowerCase()); }

  // ---- alarms log: { [date]: { [alarmId]: { at: 'HH:MM', took: seconds, activity } } }
  alarmDone(alarmId, date) { return Boolean(this.#meta.get('alarmLog')?.[date]?.[alarmId]); }
  alarmRecord(alarmId, date) { return this.#meta.get('alarmLog')?.[date]?.[alarmId] ?? null; }
  async logAlarm(alarmId, date, record) {
    const log = structuredClone(this.#meta.get('alarmLog') ?? {});
    // keep 60 days
    for (const d of Object.keys(log).sort().slice(0, -60)) delete log[d];
    log[date] = { ...(log[date] ?? {}), [alarmId]: record };
    await this.#setMeta('alarmLog', log);
    this.#emit();
  }

  // ---- charrette mode
  #ranges() { return this.#meta.get('charrette') ?? []; }
  isCharretteActive() { return this.#ranges().some((r) => r.to === null); }
  charretteSince() { return this.#ranges().find((r) => r.to === null)?.from ?? null; }
  charretteDays() { return charretteDaySet(this.#ranges(), todayKey()); }

  async setCharrette(on) {
    const today = todayKey();
    let ranges = this.#ranges().map((r) => ({ ...r }));
    if (on && !this.isCharretteActive()) ranges.push({ from: today, to: null });
    if (!on) {
      ranges = ranges.flatMap((r) => {
        if (r.to !== null) return [r];
        return r.from === today ? [] : [{ from: r.from, to: today }]; // same-day toggle leaves no trace
      });
    }
    await this.#setMeta('charrette', ranges);
    this.#emit();
  }

  // ---- backup
  async exportData() {
    const data = await repo.loadAll();
    return { format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), ...data };
  }

  async importData(json) {
    if (json?.format !== EXPORT_FORMAT) throw new Error('This file is not a Archie Line backup.');
    const data = Object.fromEntries(STORES.map((s) => [s, Array.isArray(json[s]) ? json[s] : []]));
    await repo.replaceAll(data);
    this.#hydrate(data);
    this.#emit();
  }

  async resetAll() {
    await repo.replaceAll({});
    this.#hydrate({});
    await this.load();
    this.#emit();
  }

  // ---- small settings stored alongside the data (and encrypted with it)
  setting(k) { return this.#meta.get(k); }
  async saveSetting(k, v) { await this.#setMeta(k, v); this.#emit(); }

  /** Drop everything from memory (used when the app locks). */
  unload() { this.#hydrate({}); }

  // ---- internals
  #hydrate(data) {
    this.#habits = new Map((data.habits ?? []).map((h) => [h.id, h]));
    this.#entries = new Map((data.entries ?? []).map((e) => [e.key, e.value]));
    this.#days = new Map((data.days ?? []).map((d) => [d.date, d]));
    this.#meta = new Map((data.meta ?? []).map((m) => [m.k, m.v]));
  }
  async #saveHabit(h) { this.#habits.set(h.id, h); await repo.put('habits', h); }
  async #setMeta(k, v) { this.#meta.set(k, v); await repo.put('meta', { k, v }); }
}
