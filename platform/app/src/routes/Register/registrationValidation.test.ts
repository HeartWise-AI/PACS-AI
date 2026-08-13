import {
  createPasswordCharacterPatterns,
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
    const overlongPassword = 'A!'.padEnd(129, 'a');
    expect(
      getRegistrationValidationMessage({ ...validRegistration, password: overlongPassword })
    ).toBe('Password must be 128 characters or fewer.');
  });

  it('matches the backend Unicode character categories in supported browsers', () => {
    expect(
      getRegistrationValidationMessage({
        ...validRegistration,
        password: 'Éclair—password',
        confirmPassword: 'Éclair—password',
      })
    ).toBeNull();
  });

  it('uses compatible ASCII checks when Unicode property escapes are unavailable', () => {
    const patterns = createPasswordCharacterPatterns(() => {
      throw new SyntaxError('Unicode property escapes are unavailable');
    });

    expect(patterns.uppercase.test('A')).toBe(true);
    expect(patterns.lowercase.test('a')).toBe(true);
    expect(patterns.special.test('!')).toBe(true);
    expect(patterns.special.test('\u0001')).toBe(false);
  });

  it('does not count control characters as backend-valid punctuation or symbols', () => {
    expect(
      getRegistrationValidationMessage({
        ...validRegistration,
        password: 'Control\u0001Character',
        confirmPassword: 'Control\u0001Character',
      })
    ).toBe('Password must contain one special character');
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
