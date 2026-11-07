import { describe, expect, it } from 'vitest';
import { bySim, changeSince, classIndex, classLine, DEFAULT_CLASSES, fmt, logToday, moneyData, moneySettings, parseAmount, short, simNet, totals, type MoneyData } from './money';

const m: MoneyData = moneyData({ id: 'money:h', kind: 'money', edited_at: '', deleted_at: null, data: {
  funds: 86400,
  items: [
    { id: '1', type: 'snb-main', name: '', owners: ['j'], amount: 412000, note: '' },
    { id: '2', type: 'snb-savings', name: 'Joint', owners: ['j', 'k'], amount: 295000, note: '' },
    { id: '3', type: 'sf-card', name: '', owners: ['j'], amount: 3000, note: '' },
    { id: '4', type: 'other', name: 'Car', owners: [], amount: 1000, note: '' },
  ],
} }, 'h');

describe('money', () => {
  const both = moneySettings({ snb: true, simfin: true });
  it('totals count joint once and subtract debts', () => {
    const t = totals(m, both, 50000);
    expect(t.groups.bank).toBe(707000);
    expect(t.owe).toBe(3000);
    expect(t.net).toBe(86400 + 707000 + 1000 + 50000 - 3000);
  });
  it('hides a mod that is off', () => {
    const t = totals(m, moneySettings({ snb: true }), 0);
    expect(t.owe).toBe(0);
  });
  it('splits joint accounts evenly per Sim', () => {
    expect(simNet(m, both, 'j')).toBe(412000 + 147500 - 3000);
    expect(simNet(m, both, 'k')).toBe(147500);
    const b = bySim(m, both, ['j', 'k'], 0);
    expect(b.household).toBe(1000);
    expect(b.funds).toBe(86400);
  });
  it('classes', () => {
    expect(classIndex(DEFAULT_CLASSES, -500)).toBe(0);
    expect(classIndex(DEFAULT_CLASSES, 2000)).toBe(1);
    expect(classIndex(DEFAULT_CLASSES, 1148300)).toBe(7);
    expect(classLine(DEFAULT_CLASSES, 1148300)).toBe('Top class · §148,300 above the Ultra Wealthy line');
    expect(classLine(DEFAULT_CLASSES, 388000)).toBe('§12,000 to Upper Class');
  });
  it('log keeps one entry per day and change looks before today', () => {
    let log = logToday(m, 5, 100, {});
    log = logToday({ ...m, log }, 9, 150, {});
    log = logToday({ ...m, log }, 9, 160, {});
    expect(log.length).toBe(2);
    expect(changeSince(log, 160, 9)).toEqual({ amount: 60, day: 5 });
    expect(changeSince(log, 160, 5)).toBeNull();
  });
  it('numbers', () => {
    expect(fmt(-21600)).toBe('−§21,600');
    expect(short(1148300)).toBe('§1.15M');
    expect(short(86400)).toBe('§86k');
    expect(parseAmount('§12,400')).toBe(12400);
    expect(parseAmount('1.2m')).toBe(1200000);
    expect(parseAmount('12.5k')).toBe(12500);
    expect(parseAmount('abc')).toBeNull();
  });
});
