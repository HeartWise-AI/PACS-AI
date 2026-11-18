interface ProfileCredentialDetails {
  specialtyLabel: string;
  licenseNo: string | null;
}

export const getProfileCredentialDetails = (
  specialty?: string,
  licenseNo?: string | null
): ProfileCredentialDetails => {
  const normalizedLicenseNo = licenseNo?.trim() || null;

  return {
    specialtyLabel: `${specialty || ''}${normalizedLicenseNo ? ' •' : ''}`,
    licenseNo: normalizedLicenseNo,
  };
};
