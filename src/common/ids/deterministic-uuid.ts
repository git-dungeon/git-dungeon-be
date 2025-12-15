import { createHash } from 'node:crypto';

/**
 * 입력 문자열로부터 RFC4122 UUID(v5 형태)를 안정적으로 생성한다.
 * - 테스트/드라이런 등에서 "항상 동일한 UUID"가 필요할 때 사용한다.
 * - 보안/비밀값 용도로 사용하면 안 된다.
 */
export const deterministicUuidV5 = (input: string): string => {
  const hex = createHash('sha1')
    .update('git-dungeon:')
    .update(input)
    .digest('hex')
    .slice(0, 32);

  const timeLow = hex.slice(0, 8);
  const timeMid = hex.slice(8, 12);

  const timeHiAndVersion = ((parseInt(hex.slice(12, 16), 16) & 0x0fff) | 0x5000)
    .toString(16)
    .padStart(4, '0');

  const clockSeqHiAndReserved = (
    (parseInt(hex.slice(16, 20), 16) & 0x3fff) |
    0x8000
  )
    .toString(16)
    .padStart(4, '0');

  const node = hex.slice(20, 32);

  return `${timeLow}-${timeMid}-${timeHiAndVersion}-${clockSeqHiAndReserved}-${node}`;
};
