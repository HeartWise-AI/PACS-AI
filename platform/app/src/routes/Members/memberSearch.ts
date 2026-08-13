export const filterMembers = <T extends object>(members: T[], searchValue: string): T[] => {
  const normalizedSearch = searchValue.trim().toLowerCase();
  if (!normalizedSearch) {
    return members;
  }

  return members.filter(member =>
    Object.values(member).join(' ').toLowerCase().includes(normalizedSearch)
  );
};
