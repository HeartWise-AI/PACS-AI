const getToggledClassName = isToggled => {
  return isToggled
    ? 'text-primary' // NOTE: This is a PACS changes
    : '!text-common-bright hover:!bg-[#151815] hover:text-primary-light'; // NOTE: This is a PACS change
};

export { getToggledClassName };
