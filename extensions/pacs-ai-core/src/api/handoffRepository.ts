import type { AxiosResponse } from 'axios';
import Api from '../pacsAPIAxios';
import type { APIResponse } from './dto';

/** Sign-in handoff from CardioAgent (CA-268). */
export interface HandoffSession {
  sessionToken: string;
  tenantId: string;
  returnPath: string;
}

export interface HandoffLinkResult {
  returnPath: string;
}

const handoffRepository = {
  /** Trade a one-time handoff code for a PACS-AI session (public). */
  async Exchange(code: string): Promise<HandoffSession> {
    const response: AxiosResponse<APIResponse<HandoffSession>> = await Api().post(
      '/v1/iam/handoff/exchange',
      { code }
    );
    return response.data.data;
  },

  /** Link the CardioAgent account named by a one-time code to the signed-in user. */
  async Link(code: string): Promise<HandoffLinkResult> {
    const response: AxiosResponse<APIResponse<HandoffLinkResult>> = await Api().post(
      '/v1/iam/handoff/link',
      { code }
    );
    return response.data.data;
  },
};

export default handoffRepository;
