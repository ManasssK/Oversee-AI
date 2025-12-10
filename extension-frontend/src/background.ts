// src/background.ts

// The original logic to open the side panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'executeAction') {
    if (request.action === 'create_event') {
      // Handle event creation separately
      handleCreateEvent(request);
    } else {
      // Default: rephrase/summarize with streaming
      handleActionStream(request);
    }
    return true; // keep the channel open for async response
  }
});

/**
 * Handles create_event requests using Google OAuth and backend API
 */
function handleCreateEvent(request: any) {
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (!token) {
      // User not logged in
      chrome.storage.local.set({
        lastAiMessage: {
          author: 'ai',
          text: 'Error: Please connect to your Google Account in Settings first.',
        },
      });
      return;
    }

    // Call backend endpoint for event creation
    fetch('http://localhost:3001/api/create-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, text: request.text }),
    })
      .then((res) => res.json())
      .then((data) => {
        const resultMessage = data.success
          ? data.message
          : `Error: ${data.error}`;
        chrome.storage.local.set({
          lastAiMessage: { author: 'ai', text: resultMessage },
        });
      })
      .catch((err) => console.error('Create Event Error:', err));
  });
}

/**
 * Handles streaming actions (rephrase/summarize)
 */
async function handleActionStream(request: any) {
  try {
    const response = await fetch('http://localhost:3001/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: request.action,
        text: request.text,
      }),
    });

    if (!response.body) throw new Error('Response has no body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    // Read the stream and assemble the full response
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.chunk) {
              fullResponse += data.chunk;
            }
          } catch {
            // Ignore incomplete chunks
          }
        }
      }
    }

    // Once the stream is complete, save the full response to storage
    const newMessage = { author: 'ai', text: fullResponse };
    chrome.storage.local.set({ lastAiMessage: newMessage });
  } catch (error) {
    console.error('Error in background script stream handler:', error);
  }
}
