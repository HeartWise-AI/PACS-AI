const getToggledClassName = isToggled => {
  return isToggled
    ? '!text-primary'
    : '!text-common-bright hover:!bg-[#151815] hover:text-primary-light'; // NOTE: This is a PACS change
};

export { getToggledClassName };
