import type { SettingsProfileResponse } from '../dto/settings-profile-response.dto';
import {
  assertBoolean,
  assertIsoDateTimeString,
  assertNullableIsoDateTimeString,
  assertNullableString,
  assertRecord,
  assertString,
} from '../../common/validation/runtime-validation';

export const assertSettingsProfileResponse = (
  input: SettingsProfileResponse,
): SettingsProfileResponse => {
  const root = assertRecord(input, '$');
  const profile = assertRecord(root.profile, '$.profile');
  const connections = assertRecord(root.connections, '$.connections');
  const github = assertRecord(connections.github, '$.connections.github');

  assertString(profile.userId, '$.profile.userId', { minLength: 1 });
  assertString(profile.username, '$.profile.username', { minLength: 1 });
  assertString(profile.displayName, '$.profile.displayName', { minLength: 1 });
  assertNullableString(profile.avatarUrl, '$.profile.avatarUrl');
  assertString(profile.email, '$.profile.email', { minLength: 1 });
  assertIsoDateTimeString(profile.joinedAt, '$.profile.joinedAt');

  assertBoolean(github.connected, '$.connections.github.connected');
  assertNullableIsoDateTimeString(
    github.lastSyncAt,
    '$.connections.github.lastSyncAt',
  );

  return input;
};
