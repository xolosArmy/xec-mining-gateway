import {
  ApiError,
  ChallengeResponse,
  SessionStatusResponse,
  VerificationMode,
  VerifyResponse,
} from "./types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

const buildUrl = (path: string) => `${API_BASE_URL}${path}`;

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw {
          error: `Request failed with status ${response.status}`,
          status: response.status,
        } satisfies ApiError;
      }

      throw {
        error: "Received invalid JSON from server",
        status: response.status,
      } satisfies ApiError;
    }
  }

  if (!response.ok) {
    const errorPayload =
      typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
    const errorMessage =
      typeof errorPayload.error === "string"
        ? errorPayload.error
        : text || `Request failed with status ${response.status}`;
    throw {
      error: errorMessage,
      status: response.status,
      ...(errorPayload.membership &&
      typeof errorPayload.membership === "object" &&
      errorPayload.membership !== null
        ? { membership: errorPayload.membership as ApiError["membership"] }
        : {}),
    } satisfies ApiError;
  }

  return data as T;
};

export const requestChallenge = async (
  wallet: string,
): Promise<ChallengeResponse> => {
  const response = await fetch(buildUrl("/v1/auth/request-challenge"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wallet }),
  });

  return parseJson<ChallengeResponse>(response);
};

export const verifyChallenge = async (
  params: {
    mode: VerificationMode;
    wallet: string;
    challengeId: string;
    signature: string;
    publicKey?: string;
  },
): Promise<VerifyResponse> => {
  const response = await fetch(buildUrl("/v1/auth/verify"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  return parseJson<VerifyResponse>(response);
};

export const getSessionStatus = async (
  sessionToken: string,
  options?: {
    refreshMembership?: boolean;
  },
): Promise<SessionStatusResponse> => {
  const refreshMembership = options?.refreshMembership === true;
  const path = refreshMembership
    ? "/v1/session/status?refreshMembership=true"
    : "/v1/session/status";
  const response = await fetch(buildUrl(path), {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  return parseJson<SessionStatusResponse>(response);
};

export const revokeSession = async (
  sessionToken: string,
): Promise<{ revoked: boolean }> => {
  const response = await fetch(buildUrl("/v1/session/revoke"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  return parseJson<{ revoked: boolean }>(response);
};
