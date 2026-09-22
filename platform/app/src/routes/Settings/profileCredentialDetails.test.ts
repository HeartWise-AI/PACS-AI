import { getProfileCredentialDetails } from './profileCredentialDetails';

describe('getProfileCredentialDetails', () => {
  it('shows a normalized license number after the specialty', () => {
    expect(getProfileCredentialDetails('Cardiology', '  MD-123  ')).toEqual({
      specialtyLabel: 'Cardiology •',
      licenseNo: 'MD-123',
    });
  });

  it.each([undefined, null, '', '   '])(
    'omits an absent license number and its separator for %p',
    licenseNo => {
      expect(getProfileCredentialDetails('Cardiology', licenseNo)).toEqual({
        specialtyLabel: 'Cardiology',
        licenseNo: null,
      });
    }
  );
});
