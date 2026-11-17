import { UserAccessState } from '../../api/userDTO';

export interface MemberAccessStatusPresentation {
  labelKey: 'Active' | 'Suspended' | 'Unknown';
  className: string;
}

export const getMemberAccessStatusPresentation = (
  accessState?: string
): MemberAccessStatusPresentation => {
  if (accessState === UserAccessState.ACTIVE) {
    return {
      labelKey: 'Active',
      className: 'bg-[#6ED47C] bg-opacity-20 text-[#6ED47C]',
    };
  }

  if (accessState === UserAccessState.SUSPENDED) {
    return {
      labelKey: 'Suspended',
      className: 'bg-[#FF6B6B] bg-opacity-20 text-[#FF6B6B]',
    };
  }

  return {
    labelKey: 'Unknown',
    className: 'bg-gray-300 bg-opacity-10 text-gray-400',
  };
};
