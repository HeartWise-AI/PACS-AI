import { UserAccessState } from '../../api/userDTO';
import { getMemberAccessStatusPresentation } from './memberAccessStatus';

describe('member access status presentation', () => {
  test.each([
    [UserAccessState.ACTIVE, 'Active', 'text-[#6ED47C]'],
    [UserAccessState.SUSPENDED, 'Suspended', 'text-[#FF6B6B]'],
    [undefined, 'Unknown', 'text-gray-400'],
    ['UNEXPECTED', 'Unknown', 'text-gray-400'],
  ])('maps %s to an accessible text badge', (accessState, labelKey, colorClass) => {
    expect(getMemberAccessStatusPresentation(accessState)).toMatchObject({
      labelKey,
      className: expect.stringContaining(colorClass),
    });
  });
});
