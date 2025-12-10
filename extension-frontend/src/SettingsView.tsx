import { useState, useEffect } from 'react';

export function SettingsView() {
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Check for an existing token when the component loads
  useEffect(() => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      const accessToken = token as unknown as string | undefined;
      if (accessToken) {
        setAuthToken(accessToken);
      }
    });
  }, []);

  const handleGoogleSignIn = () => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      const accessToken = token as unknown as string | undefined;
      if (chrome.runtime.lastError || !accessToken) {
        alert("Authentication failed. See console for details.");
        console.error(chrome.runtime.lastError?.message);
        return;
      }
      setAuthToken(accessToken); // Update state to show "Connected"
    });
  };

  const handleGoogleSignOut = () => {
    if (authToken) {
      chrome.identity.removeCachedAuthToken({ token: authToken }, () => {
        setAuthToken(null);
        alert("Disconnected from Google Account.");
      });
    }
  };

  return (
    <div className="settings-view">
      <h2>Integrations</h2>
      <div className="integration-card">
        <h3>Google Calendar</h3>
        <p>
          Connect your account to allow Omni to create calendar events from your
          browser content.
        </p>

        {authToken ? (
          <div className="connected-state">
            <p>✅ Connected to Google</p>
            <button onClick={handleGoogleSignOut} className="disconnect-button">
              Disconnect
            </button>
          </div>
        ) : (
          <button onClick={handleGoogleSignIn} className="connect-button">
            Connect Google Account
          </button>
        )}
      </div>
    </div>
  );
}
