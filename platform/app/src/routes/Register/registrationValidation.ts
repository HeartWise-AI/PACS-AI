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

interface PasswordCharacterPatterns {
  uppercase: RegExp;
  lowercase: RegExp;
  special: RegExp;
}

type RegExpFactory = (source: string, flags: string) => RegExp;

export const createPasswordCharacterPatterns = (
  createRegExp: RegExpFactory = (source, flags) => new RegExp(source, flags)
): PasswordCharacterPatterns => {
  try {
    return {
      uppercase: createRegExp('\\p{Lu}', 'u'),
      lowercase: createRegExp('\\p{Ll}', 'u'),
      special: createRegExp('[\\p{P}\\p{S}]', 'u'),
    };
  } catch {
    return {
      uppercase: /[A-Z]/,
      lowercase: /[a-z]/,
      special: /[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]/,
    };
  }
};

const passwordCharacterPatterns = createPasswordCharacterPatterns();

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
  if (!passwordCharacterPatterns.uppercase.test(password)) {
    return 'Password must contain one uppercase';
  }
  if (!passwordCharacterPatterns.lowercase.test(password)) {
    return 'Password must contain one lowercase';
  }
  if (!passwordCharacterPatterns.special.test(password)) {
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
