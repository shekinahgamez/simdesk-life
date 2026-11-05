import { describe, expect, it } from 'vitest';
import { bannerForName } from './bannerNames';

describe('banner from a name', () => {
  it('knows the game’s holiday names', () => {
    expect(bannerForName('Winterfest', 'holiday')).toBe('christmas');
    expect(bannerForName('Harvest Fest', 'holiday')).toBe('thanksgiving');
    expect(bannerForName('Harvestfest', 'holiday')).toBe('thanksgiving');
    expect(bannerForName('Love Day', 'holiday')).toBe('loveday');
    expect(bannerForName('New Year’s Eve', 'holiday')).toBe('newyear');
  });
  it('knows real ones, however they are typed', () => {
    expect(bannerForName('juneteenth cookout', 'holiday')).toBe('juneteenth');
    expect(bannerForName('Mother’s Day brunch', 'holiday')).toBe('mothers');
    expect(bannerForName("Fourth of July", 'holiday')).toBe('july4');
    expect(bannerForName('Eid al-Fitr', 'holiday')).toBe('eid');
  });
  it('does not guess from part of a word', () => {
    expect(bannerForName('Priderock', 'holiday')).toBeNull();
    expect(bannerForName('Spring Fling', 'holiday')).toBeNull();
    expect(bannerForName('', 'holiday')).toBeNull();
  });
  it('picks events and trips, and the longer match wins', () => {
    expect(bannerForName('Maya’s baby shower', 'event')).toBe('baby');
    expect(bannerForName('Game night at Luz’s', 'event')).toBe('gamenight');
    expect(bannerForName('Grandpa’s funeral', 'event')).toBe('funeral');
    expect(bannerForName('Italian getaway', 'trip')).toBe('italy');
    expect(bannerForName('Ski weekend', 'trip')).toBe('ski');
    expect(bannerForName('Okafors in Selvadorada', 'trip')).toBeNull();
  });
});
