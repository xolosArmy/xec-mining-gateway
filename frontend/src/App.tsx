import { useState } from "react";

import {
  getSessionStatus,
  requestChallenge,
  revokeSession,
  verifyChallenge,
} from "./api";
import {
  ApiError,
  ChallengeResponse,
  MembershipResponse,
  SessionStatusResponse,
  VerificationMode,
  VerifyResponse,
} from "./types";

const DEFAULT_PLACEHOLDER =
  "ecash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a";

type LatestResponse =
  | ChallengeResponse
  | VerifyResponse
  | SessionStatusResponse
  | { revoked: boolean }
  | ApiError
  | null;

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "error" in error) {
    return String((error as ApiError).error);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
};

const getMembershipFromError = (error: unknown): MembershipResponse | undefined => {
  if (
    typeof error === "object" &&
    error !== null &&
    "membership" in error &&
    error.membership &&
    typeof error.membership === "object"
  ) {
    return error.membership as MembershipResponse;
  }

  return undefined;
};

const getStatusCode = (error: unknown): number | undefined => {
  if (typeof error === "object" && error !== null && "status" in error) {
    const { status } = error as ApiError;
    return typeof status === "number" ? status : undefined;
  }

  return undefined;
};

const renderMembershipFields = (membership: MembershipResponse) => (
  <div className="result-grid">
    <div>
      <span className="result-label">Membership Active</span>
      <pre className="code-block">{String(membership.active)}</pre>
    </div>
    <div>
      <span className="result-label">Membership Tier</span>
      <pre className="code-block">{membership.tier}</pre>
    </div>
    <div>
      <span className="result-label">Membership Source</span>
      <pre className="code-block">{membership.source}</pre>
    </div>
    <div>
      <span className="result-label">RMZ Atoms</span>
      <pre className="code-block">{membership.rmzAtoms ?? "n/a"}</pre>
    </div>
    <div>
      <span className="result-label">RMZ Required Atoms</span>
      <pre className="code-block">{membership.rmzRequiredAtoms ?? "n/a"}</pre>
    </div>
    <div>
      <span className="result-label">Payment Mode</span>
      <pre className="code-block">{String(membership.paymentMode ?? false)}</pre>
    </div>
    <div className="result-full">
      <span className="result-label">RMZ Token ID</span>
      <pre className="code-block">{membership.tokenId ?? "n/a"}</pre>
    </div>
    <div className="result-full">
      <span className="result-label">Treasury Address</span>
      <pre className="code-block">{membership.treasuryAddress ?? "n/a"}</pre>
    </div>
    <div>
      <span className="result-label">Required Payment Atoms</span>
      <pre className="code-block">
        {membership.requiredPaymentAtoms ?? "n/a"}
      </pre>
    </div>
    <div>
      <span className="result-label">Paid Atoms</span>
      <pre className="code-block">{membership.paidAtoms ?? "n/a"}</pre>
    </div>
    <div>
      <span className="result-label">Window Days</span>
      <pre className="code-block">{membership.windowDays ?? "n/a"}</pre>
    </div>
    <div className="result-full">
      <span className="result-label">Payment Txid</span>
      <pre className="code-block">{membership.paymentTxid ?? "n/a"}</pre>
    </div>
    <div>
      <span className="result-label">Payment Timestamp</span>
      <pre className="code-block">{membership.paymentTimestamp ?? "n/a"}</pre>
    </div>
    <div>
      <span className="result-label">Valid Until</span>
      <pre className="code-block">{membership.validUntil ?? "n/a"}</pre>
    </div>
    {membership.error && (
      <div className="result-full">
        <span className="result-label">Membership Error</span>
        <pre className="code-block">{membership.error}</pre>
      </div>
    )}
  </div>
);

function App() {
  const [wallet, setWallet] = useState("");
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [session, setSession] = useState<VerifyResponse | null>(null);
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatusResponse | null>(null);
  const [verificationMode, setVerificationMode] =
    useState<VerificationMode>("mock");
  const [tonalliPublicKey, setTonalliPublicKey] = useState("");
  const [tonalliSignature, setTonalliSignature] = useState("");
  const [latestResponse, setLatestResponse] = useState<LatestResponse>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const mockSignature =
    wallet.trim() && challenge?.challengeId
      ? `mock-signature:${wallet.trim()}:${challenge.challengeId}`
      : "";

  const handleRequestChallenge = async () => {
    const trimmedWallet = wallet.trim();

    if (!trimmedWallet) {
      setErrorMessage("Enter a wallet address before requesting a challenge.");
      setSuccessMessage("");
      return;
    }

    setLoadingAction("challenge");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await requestChallenge(trimmedWallet);
      setChallenge(response);
      setSession(null);
      setSessionStatus(null);
      setLatestResponse(response);
      setSuccessMessage("Challenge created.");
    } catch (error) {
      const apiError = {
        error: getErrorMessage(error),
        status: getStatusCode(error),
        membership: getMembershipFromError(error),
      } satisfies ApiError;
      setLatestResponse(apiError);
      setErrorMessage(
        apiError.status === 403 &&
        apiError.error === "RMZ membership payment required"
          ? "RMZ membership payment required"
          : apiError.status === 403 || apiError.error === "RMZ membership required"
            ? "RMZ membership required"
          : apiError.error,
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleVerify = async () => {
    if (!challenge) {
      return;
    }

    const trimmedWallet = wallet.trim();
    const trimmedPublicKey = tonalliPublicKey.trim();
    const trimmedTonalliSignature = tonalliSignature.trim();
    const signature =
      verificationMode === "mock" ? mockSignature : trimmedTonalliSignature;

    if (!signature) {
      setErrorMessage(
        verificationMode === "mock"
          ? "Request a challenge before verifying the mock signature."
          : "Enter the Tonalli public key and signature before verifying.",
      );
      setSuccessMessage("");
      return;
    }

    setLoadingAction("verify");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await verifyChallenge({
        mode: verificationMode,
        wallet: trimmedWallet,
        challengeId: challenge.challengeId,
        signature,
        ...(verificationMode === "tonalli" ? { publicKey: trimmedPublicKey } : {}),
      });
      setSession(response);
      setSessionStatus(null);
      setLatestResponse(response);
      setSuccessMessage("Session token issued.");
    } catch (error) {
      const apiError = {
        error: getErrorMessage(error),
        status: getStatusCode(error),
        membership: getMembershipFromError(error),
      } satisfies ApiError;
      setLatestResponse(apiError);
      setErrorMessage(apiError.error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCheckStatus = async () => {
    if (!session?.sessionToken) {
      return;
    }

    setLoadingAction("status");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await getSessionStatus(session.sessionToken);
      setSessionStatus(response);
      setLatestResponse(response);
      setSuccessMessage(response.active ? "Session is active." : "Session is inactive.");
    } catch (error) {
      const apiError = {
        error: getErrorMessage(error),
      } satisfies ApiError;
      setLatestResponse(apiError);
      setErrorMessage(apiError.error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRevoke = async () => {
    if (!session?.sessionToken) {
      return;
    }

    setLoadingAction("revoke");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await revokeSession(session.sessionToken);
      setLatestResponse(response);
      setSessionStatus(null);
      setSuccessMessage("Session revoked. You can check status again to confirm.");
    } catch (error) {
      const apiError = {
        error: getErrorMessage(error),
      } satisfies ApiError;
      setLatestResponse(apiError);
      setErrorMessage(apiError.error);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="app-shell">
      <main className="container">
        <header className="hero card">
          <p className="eyebrow">Membership Portal Prototype</p>
          <h1>eCash México Mining Gateway</h1>
          <p className="subtitle">
            Prototype 2 for the eCash México Sovereign Mining Infrastructure
            Teyolia campaign.
          </p>
          <p className="note">
            Membership access is powered by RMZ. Prototype 6 introduces
            Chronik-based RMZ verification.
          </p>
          <p className="note">
            Approved test wallet: <code>{DEFAULT_PLACEHOLDER}</code>
          </p>
          <p className="note">
            Chronik mode verifies RMZ ownership on-chain. Mock mode uses a
            development registry.
          </p>
          <p className="note">
            Payment mode verifies recent RMZ payments to the eCash México
            Treasury. Proof-of-Hold mode remains available for prototype testing.
          </p>
        </header>

        <section className="card">
          <div className="section-heading">
            <h2>Wallet Input</h2>
            <span className="status-badge neutral">Step 1</span>
          </div>
          <label className="field-label" htmlFor="wallet">
            Wallet address
          </label>
          <div className="input-row">
            <input
              id="wallet"
              type="text"
              value={wallet}
              onChange={(event) => setWallet(event.target.value)}
              placeholder={DEFAULT_PLACEHOLDER}
            />
            <button
              type="button"
              onClick={handleRequestChallenge}
              disabled={loadingAction !== null}
            >
              {loadingAction === "challenge" ? "Requesting..." : "Request Challenge"}
            </button>
          </div>

          {challenge && (
            <div className="result-grid">
              <div>
                <span className="result-label">Wallet</span>
                <pre className="code-block">{challenge.wallet}</pre>
              </div>
              <div>
                <span className="result-label">Challenge ID</span>
                <pre className="code-block">{challenge.challengeId}</pre>
              </div>
              <div>
                <span className="result-label">Nonce</span>
                <pre className="code-block">{challenge.nonce}</pre>
              </div>
              <div>
                <span className="result-label">Issued At</span>
                <pre className="code-block">{challenge.issuedAt}</pre>
              </div>
              <div>
                <span className="result-label">Expires At</span>
                <pre className="code-block">{challenge.expiresAt}</pre>
              </div>
              <div className="result-full">
                <span className="result-label">Challenge Message</span>
                <pre className="code-block">{challenge.message}</pre>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-heading">
            <h2>Verification Mode</h2>
            <span className="status-badge neutral">Step 2</span>
          </div>
          <label className="field-label" htmlFor="verificationMode">
            Verification Mode
          </label>
          <select
            id="verificationMode"
            value={verificationMode}
            onChange={(event) =>
              setVerificationMode(event.target.value as VerificationMode)
            }
          >
            <option value="mock">Mock Prototype</option>
            <option value="tonalli">Tonalli Signature</option>
          </select>

          {verificationMode === "mock" ? (
            <>
              <span className="result-label">Generated signature</span>
              <pre className="code-block dimmed">
                {mockSignature || "Request a challenge to generate the mock signature."}
              </pre>
              <p className="note">
                Mock mode preserves the existing prototype flow using
                <code>mock-signature:&lt;wallet&gt;:&lt;challengeId&gt;</code>.
              </p>
            </>
          ) : (
            <>
              <p className="note">
                Tonalli mode expects a real signature produced by Tonalli Wallet
                over the exact challenge message shown above.
              </p>
              <label className="field-label" htmlFor="tonalliPublicKey">
                Public key
              </label>
              <textarea
                id="tonalliPublicKey"
                value={tonalliPublicKey}
                onChange={(event) => setTonalliPublicKey(event.target.value)}
                placeholder="Paste the publicKey returned by Tonalli Connect"
                rows={3}
              />
              <label className="field-label" htmlFor="tonalliSignature">
                Signature
              </label>
              <textarea
                id="tonalliSignature"
                value={tonalliSignature}
                onChange={(event) => setTonalliSignature(event.target.value)}
                placeholder="Paste the signature returned by Tonalli Wallet signMessage(message)"
                rows={4}
              />
            </>
          )}
          <button
            type="button"
            onClick={handleVerify}
            disabled={
              !challenge ||
              (verificationMode === "mock" && !mockSignature) ||
              (verificationMode === "tonalli" &&
                (!tonalliPublicKey.trim() || !tonalliSignature.trim())) ||
              loadingAction !== null
            }
          >
            {loadingAction === "verify"
              ? "Verifying..."
              : "Verify & Issue Session Token"}
          </button>

          {session && (
            <>
              <div className="result-grid">
                <div>
                  <span className="result-label">Token Type</span>
                  <pre className="code-block">{session.tokenType}</pre>
                </div>
                <div>
                  <span className="result-label">Plan</span>
                  <pre className="code-block">{session.plan}</pre>
                </div>
                <div>
                  <span className="result-label">Expires In</span>
                  <pre className="code-block">{session.expiresIn} seconds</pre>
                </div>
                <div className="result-full">
                  <span className="result-label">Session Token</span>
                  <pre className="code-block">{session.sessionToken}</pre>
                </div>
              </div>
              {session.membership && renderMembershipFields(session.membership)}
            </>
          )}

          {!session &&
            latestResponse &&
            "membership" in latestResponse &&
            latestResponse.membership &&
            renderMembershipFields(latestResponse.membership)}

          {!session &&
            latestResponse &&
            "error" in latestResponse &&
            latestResponse.error === "RMZ membership payment required" && (
              <p className="note">
                Payment mode requires a recent RMZ treasury payment within the
                configured membership window.
              </p>
            )}
        </section>

        <section className="card">
          <div className="section-heading">
            <h2>Session Status</h2>
            <span
              className={`status-badge ${
                sessionStatus?.active ? "success" : "neutral"
              }`}
            >
              Step 3
            </span>
          </div>
          <div className="action-row">
            <button
              type="button"
              onClick={handleCheckStatus}
              disabled={!session || loadingAction !== null}
            >
              {loadingAction === "status"
                ? "Checking..."
                : "Check Session Status"}
            </button>
          </div>

          {sessionStatus && (
            <div className="result-grid">
              <div>
                <span className="result-label">Active</span>
                <div>
                  <span
                    className={`status-badge ${
                      sessionStatus.active ? "success" : "danger"
                    }`}
                  >
                    {sessionStatus.active ? "active" : "inactive"}
                  </span>
                </div>
              </div>
              <div>
                <span className="result-label">Plan</span>
                <pre className="code-block">{sessionStatus.plan ?? "n/a"}</pre>
              </div>
              <div className="result-full">
                <span className="result-label">Wallet</span>
                <pre className="code-block">{sessionStatus.wallet ?? "n/a"}</pre>
              </div>
              <div className="result-full">
                <span className="result-label">Expires At</span>
                <pre className="code-block">
                  {sessionStatus.expiresAt ?? "n/a"}
                </pre>
              </div>
              <div className="result-full">
                <span className="result-label">Membership Valid Until</span>
                <pre className="code-block">
                  {sessionStatus.membershipValidUntil ?? "n/a"}
                </pre>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-heading">
            <h2>Revoke Session</h2>
            <span className="status-badge neutral">Step 4</span>
          </div>
          <p className="note">
            Revocation is now stored in Redis and shared with the Stratum Gateway
            mock.
          </p>
          <button
            type="button"
            className="button-secondary"
            onClick={handleRevoke}
            disabled={!session || loadingAction !== null}
          >
            {loadingAction === "revoke" ? "Revoking..." : "Revoke Session"}
          </button>
        </section>

        <section className="card">
          <div className="section-heading">
            <h2>Debug Panel</h2>
            <span className="status-badge neutral">JSON</span>
          </div>
          <pre className="code-block debug-panel">
            {JSON.stringify(
              latestResponse ?? { message: "No API response yet." },
              null,
              2,
            )}
          </pre>
        </section>

        {(errorMessage || successMessage) && (
          <section className="feedback-stack">
            {errorMessage && <p className="feedback error">{errorMessage}</p>}
            {successMessage && (
              <p className="feedback success">{successMessage}</p>
            )}
          </section>
        )}

        <footer className="footer card">
          <p>Open infrastructure. No custody. Built for the eCash ecosystem.</p>
          <div className="footer-links">
            <a
              href="https://github.com/xolosArmy/xec-mining-gateway"
              target="_blank"
              rel="noreferrer"
            >
              GitHub repo
            </a>
            <a
              href="https://www.teyolia.cash/campaigns/campaign-1778614261973"
              target="_blank"
              rel="noreferrer"
            >
              Teyolia campaign
            </a>
            <a href="https://ecash.mx" target="_blank" rel="noreferrer">
              eCash México
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
