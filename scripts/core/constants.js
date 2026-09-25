export const STORAGE_KEY = 'valtrain_data_v1';

export const EXERCISE_PRESETS = [
  'Speed — Easy',
  'Speed — Medium',
  'Speed — Hard',
  'Streak — Eliminate 50',
  'Streak — Eliminate 100',
  'Bots — Strafe',
  'Bots — Reset',
  'Deathmatch'
];

export const EXERCISE_PRESET_DEFAULTS = {
  'Speed — Easy': { resultType: 'count', unit: 'ботов' },
  'Speed — Medium': { resultType: 'count', unit: 'ботов' },
  'Speed — Hard': { resultType: 'count', unit: 'ботов' },
  'Streak — Eliminate 50': { resultType: 'time', unit: 'сек' },
  'Streak — Eliminate 100': { resultType: 'time', unit: 'сек' }
};

export const WEAPONS = [
  'Без оружия', 'Classic', 'Shorty', 'Frenzy', 'Ghost', 'Sheriff',
  'Stinger', 'Spectre', 'Bucky', 'Judge', 'Bulldog', 'Guardian',
  'Phantom', 'Vandal', 'Marshal', 'Outlaw', 'Operator', 'Ares', 'Odin'
];

export const RESULT_TYPES = [
  ['time', 'Время'],
  ['count', 'Количество'],
  ['score', 'Счёт A / B'],
  ['placement', 'Место'],
  ['scorePlacement', 'Счёт + место'],
  ['text', 'Текст']
];
