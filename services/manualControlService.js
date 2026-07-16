const moment = require('moment-timezone');
const User = require('../models/User');

const DEFAULT_MANUAL_CONTROL_PREFERENCES = Object.freeze({
  durationSelectionEnabled: false,
  workdayEndTime: '18:00',
  timeZone: 'America/Argentina/Buenos_Aires'
});

const CONTROL_OPTION_MINUTES = Object.freeze({
  '30m': 30,
  '2h': 120,
  '8h': 480
});

const MANUAL_CONTROL_OPTIONS = Object.freeze([
  ...Object.keys(CONTROL_OPTION_MINUTES),
  'workday',
  'manual'
]);

function isValidWorkdayEndTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeManualControlPreferences(preferences) {
  const source = preferences?.toObject ? preferences.toObject() : preferences || {};

  return {
    durationSelectionEnabled: source.durationSelectionEnabled === true,
    workdayEndTime: isValidWorkdayEndTime(source.workdayEndTime)
      ? source.workdayEndTime
      : DEFAULT_MANUAL_CONTROL_PREFERENCES.workdayEndTime,
    timeZone: moment.tz.zone(source.timeZone)
      ? source.timeZone
      : DEFAULT_MANUAL_CONTROL_PREFERENCES.timeZone
  };
}

function isSupportedControlOption(value) {
  return MANUAL_CONTROL_OPTIONS.includes(value);
}

async function getClientManualControlPreferences(clientId) {
  if (!clientId) {
    return { ...DEFAULT_MANUAL_CONTROL_PREFERENCES };
  }

  const clientUser = await User.findOne({ clientId, role: 'client' })
    .select('manualControlPreferences');

  return normalizeManualControlPreferences(clientUser?.manualControlPreferences);
}

function calculateWorkdayExpiration(now, preferences) {
  const normalizedPreferences = normalizeManualControlPreferences(preferences);
  const [hour, minute] = normalizedPreferences.workdayEndTime.split(':').map(Number);
  const localNow = moment(now).tz(normalizedPreferences.timeZone);
  const localEnd = localNow.clone().hour(hour).minute(minute).second(0).millisecond(0);

  if (!localEnd.isAfter(localNow)) {
    const error = new Error('La jornada configurada ya finalizo');
    error.code = 'WORKDAY_ALREADY_ENDED';
    throw error;
  }

  return localEnd.toDate();
}

function createHumanControlState(option = '30m', preferences, now = new Date()) {
  if (!isSupportedControlOption(option)) {
    const error = new Error('Duracion de control no valida');
    error.code = 'INVALID_CONTROL_OPTION';
    throw error;
  }

  const state = {
    chatStatus: 'human',
    statusChangeTime: now,
    manualControlOption: option,
    manualControlExpiresAt: null,
    manualControlLocked: option === 'manual'
  };

  if (CONTROL_OPTION_MINUTES[option]) {
    state.manualControlExpiresAt = new Date(
      now.getTime() + CONTROL_OPTION_MINUTES[option] * 60 * 1000
    );
  } else if (option === 'workday') {
    state.manualControlExpiresAt = calculateWorkdayExpiration(now, preferences);
  }

  return state;
}

function createBotControlState() {
  return {
    chatStatus: 'bot',
    statusChangeTime: null,
    manualControlOption: null,
    manualControlExpiresAt: null,
    manualControlLocked: false
  };
}

function applyControlState(target, state) {
  Object.entries(state).forEach(([key, value]) => {
    target[key] = value;
  });

  return target;
}

function getEffectiveControlExpiration(control) {
  if (!control || control.chatStatus !== 'human' || control.manualControlLocked) {
    return null;
  }

  if (control.manualControlExpiresAt) {
    const explicitExpiration = new Date(control.manualControlExpiresAt);
    if (!Number.isNaN(explicitExpiration.getTime())) {
      return explicitExpiration;
    }
  }

  if (control.statusChangeTime) {
    const legacyStart = new Date(control.statusChangeTime);
    if (!Number.isNaN(legacyStart.getTime())) {
      return new Date(legacyStart.getTime() + CONTROL_OPTION_MINUTES['30m'] * 60 * 1000);
    }
  }

  return null;
}

function isManualControlExpired(control, now = new Date()) {
  const expiration = getEffectiveControlExpiration(control);
  return Boolean(expiration && expiration.getTime() <= now.getTime());
}

function renewManualControl(target, now = new Date()) {
  if (!target || target.chatStatus !== 'human') {
    return target;
  }

  const option = target.manualControlLocked
    ? 'manual'
    : target.manualControlOption || '30m';

  target.statusChangeTime = now;

  if (CONTROL_OPTION_MINUTES[option]) {
    target.manualControlOption = option;
    target.manualControlExpiresAt = new Date(
      now.getTime() + CONTROL_OPTION_MINUTES[option] * 60 * 1000
    );
  }

  return target;
}

function mergeManualControlState(chat, chatState) {
  const humanSources = [chat, chatState].filter(source => source?.chatStatus === 'human');

  if (!humanSources.length) {
    return createBotControlState();
  }

  const locked = humanSources.some(source => source.manualControlLocked);
  const latestSource = humanSources.reduce((latest, source) => {
    const latestTime = new Date(latest?.statusChangeTime || 0).getTime();
    const sourceTime = new Date(source?.statusChangeTime || 0).getTime();
    return sourceTime > latestTime ? source : latest;
  }, humanSources[0]);

  const expirations = humanSources
    .map(getEffectiveControlExpiration)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    chatStatus: 'human',
    statusChangeTime: latestSource?.statusChangeTime || null,
    manualControlOption: locked
      ? 'manual'
      : latestSource?.manualControlOption || '30m',
    manualControlExpiresAt: locked ? null : expirations[0] || null,
    manualControlLocked: locked
  };
}

function getControlResponse(control) {
  return {
    chatStatus: control?.chatStatus || 'bot',
    statusChangeTime: control?.statusChangeTime || null,
    manualControlOption: control?.manualControlLocked
      ? 'manual'
      : control?.manualControlOption || (control?.chatStatus === 'human' ? '30m' : null),
    manualControlExpiresAt: getEffectiveControlExpiration(control),
    manualControlLocked: Boolean(control?.manualControlLocked)
  };
}

module.exports = {
  DEFAULT_MANUAL_CONTROL_PREFERENCES,
  MANUAL_CONTROL_OPTIONS,
  normalizeManualControlPreferences,
  isValidWorkdayEndTime,
  isSupportedControlOption,
  getClientManualControlPreferences,
  createHumanControlState,
  createBotControlState,
  applyControlState,
  getEffectiveControlExpiration,
  isManualControlExpired,
  renewManualControl,
  mergeManualControlState,
  getControlResponse
};
