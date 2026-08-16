import axios from 'axios';
import pacsAPIAxios from './pacsAPIAxios';
import { handleAccountSuspendedError } from './service/accountAccessSession';
import { handlePolicyAcceptanceRequiredError } from './service/policyAcceptanceSession';

jest.mock('axios');
jest.mock('./service/accountAccessSession', () => ({
  handleAccountSuspendedError: jest.fn(),
}));
jest.mock('./service/policyAcceptanceSession', () => ({
  handlePolicyAcceptanceRequiredError: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedSuspendedHandler = handleAccountSuspendedError as jest.MockedFunction<
  typeof handleAccountSuspendedError
>;
const mockedPolicyHandler = handlePolicyAcceptanceRequiredError as jest.MockedFunction<
  typeof handlePolicyAcceptanceRequiredError
>;

describe('PACS API client interceptors', () => {
  const requestInterceptorUse = jest.fn();
  const responseInterceptorUse = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('sessionToken', 'session-token');
    mockedAxios.create.mockReturnValue({
      interceptors: {
        request: { use: requestInterceptorUse },
        response: { use: responseInterceptorUse },
      },
    } as never);
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('keeps the bearer configuration and installs the response interceptor', () => {
    pacsAPIAxios();

    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token',
        }),
      })
    );
    expect(requestInterceptorUse).toHaveBeenCalledTimes(1);
    expect(responseInterceptorUse).toHaveBeenCalledTimes(1);
  });

  test('uses the latest bearer token when a request is sent', () => {
    pacsAPIAxios();
    localStorage.setItem('sessionToken', 'refreshed-session-token');
    const requestHandler = requestInterceptorUse.mock.calls[0][0];

    const config = requestHandler({
      headers: { Authorization: 'Bearer session-token' },
    });

    expect(config.headers.Authorization).toBe('Bearer refreshed-session-token');
  });

  test('does not reuse a bearer token after the session is cleared', () => {
    pacsAPIAxios();
    localStorage.removeItem('sessionToken');
    const requestHandler = requestInterceptorUse.mock.calls[0][0];

    const config = requestHandler({
      headers: { Authorization: 'Bearer session-token' },
    });

    expect(config.headers.Authorization).toBeUndefined();
  });

  test('handles suspension before preserving the original rejection', async () => {
    const error = { response: { data: { errorCode: 'ACCOUNT_SUSPENDED' } } };
    pacsAPIAxios();
    const rejectionHandler = responseInterceptorUse.mock.calls[0][1];

    await expect(rejectionHandler(error)).rejects.toBe(error);
    expect(mockedSuspendedHandler).toHaveBeenCalledWith(error);
    expect(mockedPolicyHandler).toHaveBeenCalledWith(error);
  });
});
