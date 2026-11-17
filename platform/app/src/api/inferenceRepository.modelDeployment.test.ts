import Api from '../pacsAPIAxios';
import inferenceRepository from './inferenceRepository';

jest.mock('../pacsAPIAxios');

const mockedApi = Api as jest.MockedFunction<typeof Api>;

describe('inference model deployment repository', () => {
  const get = jest.fn();
  const post = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.mockReturnValue({ get, post } as never);
  });

  test('starts an asynchronous deployment through the selected catalog version', async () => {
    const response = {
      success: true,
      message: 'Inference model deployment accepted.',
      data: { deploymentId: 'deployment-1', status: 'PENDING', stage: 'resolve_active' },
    };
    post.mockResolvedValue({ data: response });

    await expect(
      inferenceRepository.DeployInferenceModelVersion('model-1', 'catalog-version-2')
    ).resolves.toEqual(response);

    expect(post).toHaveBeenCalledWith(
      '/v1/inference/model/model-1/versions/catalog-version-2/deploy'
    );
  });

  test('loads a durable deployment snapshot', async () => {
    const response = {
      success: true,
      message: 'Successfully retrieved inference model deployment.',
      data: { deployment: { id: 'deployment-1', sequence: 4 } },
    };
    get.mockResolvedValue({ data: response });

    await expect(
      inferenceRepository.GetInferenceModelDeploymentOperation('model-1', 'deployment-1')
    ).resolves.toEqual(response);

    expect(get).toHaveBeenCalledWith('/v1/inference/model/model-1/deployments/deployment-1');
  });
});
