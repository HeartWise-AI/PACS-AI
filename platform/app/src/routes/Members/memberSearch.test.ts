import { filterMembers } from './memberSearch';

const members = [
  { id: 'one', name: 'Alex Admin', email: 'alex@example.com', accessState: 'ACTIVE' },
  { id: 'two', name: 'Sam User', email: 'sam@example.com', accessState: 'SUSPENDED' },
];

describe('member filtering', () => {
  test('preserves the active filter when refreshed member objects are supplied', () => {
    const refreshedMembers = members.map(member => ({ ...member }));

    expect(filterMembers(refreshedMembers, 'suspended')).toEqual([refreshedMembers[1]]);
    expect(filterMembers(refreshedMembers, ' ALEX@EXAMPLE.COM ')).toEqual([refreshedMembers[0]]);
  });

  test('returns the refreshed list when the filter is blank', () => {
    expect(filterMembers(members, '  ')).toBe(members);
  });
});
