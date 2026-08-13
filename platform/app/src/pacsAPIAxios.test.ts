import axios from 'axios';
import pacsAPIAxios from './pacsAPIAxios';
import { handleAccountSuspendedError } from './service/accountAccessSession';

jest.mock('axios');
jest.mock('./service/accountAccessSession', () => ({
  handleAccountSuspendedError: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedSuspendedHandler = handleAccountSuspendedError as jest.MockedFunction<
  typeof handleAccountSuspendedError
>;

describe('PACS API client suspended-session interceptor', () => {
  const responseInterceptorUse = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('sessionToken', 'session-token');
    mockedAxios.create.mockReturnValue({
      interceptors: { response: { use: responseInterceptorUse } },
    } as never);
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('keeps the bearer configuration and installs the response interceptor', () => {
    pacsAPIAxios();

    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer session-token' }),
      })
    );
    expect(responseInterceptorUse).toHaveBeenCalledTimes(1);
  });

  test('handles suspension before preserving the original rejection', async () => {
    const error = { response: { data: { errorCode: 'ACCOUNT_SUSPENDED' } } };
    pacsAPIAxios();
    const rejectionHandler = responseInterceptorUse.mock.calls[0][1];

    await expect(rejectionHandler(error)).rejects.toBe(error);
    expect(mockedSuspendedHandler).toHaveBeenCalledWith(error);
  });
});
