import {
  getRegistrationValidationMessage,
  type RegistrationValidationValues,
} from './registrationValidation';

const validRegistration: RegistrationValidationValues = {
  email: 'person@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  licenseNo: '12345',
  specialty: 'cardiology',
  password: 'Strong!Password',
  confirmPassword: 'Strong!Password',
  invitationCode: 'invite-code',
};

describe('getRegistrationValidationMessage', () => {
  it('accepts fields that match the live backend limits', () => {
    expect(getRegistrationValidationMessage(validRegistration)).toBeNull();
  });

  it('rejects invalid email and mismatched passwords clearly', () => {
    expect(getRegistrationValidationMessage({ ...validRegistration, email: 'not-an-email' })).toBe(
      'Please enter a valid email address.'
    );
    expect(
      getRegistrationValidationMessage({
        ...validRegistration,
        confirmPassword: 'Different!Password',
      })
    ).toBe('Passwords do not match');
  });

  it('matches the backend password strength and length contract', () => {
    expect(
      getRegistrationValidationMessage({ ...validRegistration, password: 'NoSpecialCharacter' })
    ).toBe('Password must contain one special character');
    expect(
      getRegistrationValidationMessage({
        ...validRegistration,
        password: `Aa!${'x'.repeat(126)}`,
      })
    ).toBe('Password must be 128 characters or fewer.');
  });

  it('rejects bounded fields before sending them', () => {
    expect(
      getRegistrationValidationMessage({
        ...validRegistration,
        firstName: 'x'.repeat(100),
        lastName: 'y',
      })
    ).toBe('First and last name together must be 100 characters or fewer.');
    expect(
      getRegistrationValidationMessage({
        ...validRegistration,
        invitationCode: 'x'.repeat(257),
      })
    ).toBe('Invitation code must be 256 characters or fewer.');
  });
});
