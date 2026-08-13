export interface RegistrationValidationValues {
  email: string;
  firstName: string;
  lastName: string;
  licenseNo: string;
  specialty: string;
  password: string;
  confirmPassword: string;
  invitationCode?: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const getRegistrationValidationMessage = ({
  email,
  firstName,
  lastName,
  licenseNo,
  specialty,
  password,
  confirmPassword,
  invitationCode,
}: RegistrationValidationValues): string | null => {
  if (
    !email.trim() ||
    !firstName.trim() ||
    !lastName.trim() ||
    !licenseNo.trim() ||
    !specialty.trim() ||
    !password ||
    !confirmPassword
  ) {
    return 'Please fill all required fields';
  }
  if (!emailPattern.test(email.trim())) {
    return 'Please enter a valid email address.';
  }
  if (`${firstName.trim()} ${lastName.trim()}`.length > 100) {
    return 'First and last name together must be 100 characters or fewer.';
  }
  if (email.trim().length > 254) {
    return 'Email address must be 254 characters or fewer.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (password.length > 128) {
    return 'Password must be 128 characters or fewer.';
  }
  if (!/\p{Lu}/u.test(password)) {
    return 'Password must contain one uppercase';
  }
  if (!/\p{Ll}/u.test(password)) {
    return 'Password must contain one lowercase';
  }
  if (!/[^\p{L}\p{N}\s]/u.test(password)) {
    return 'Password must contain one special character';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  if (licenseNo.trim().length > 100) {
    return 'License number must be 100 characters or fewer.';
  }
  if (specialty.trim().length > 100) {
    return 'Specialty must be 100 characters or fewer.';
  }
  if ((invitationCode?.trim().length || 0) > 256) {
    return 'Invitation code must be 256 characters or fewer.';
  }
  return null;
};
