import { Readability } from '@mozilla/readability';

console.log("Omni content script loaded. (v6 with Readability + Popup + Create Event)");

// ===================================================
// PART 1: Popup creation and button click handler
// ===================================================
let popup: HTMLDivElement | null = null;

function createPopup() {
  if (popup) return;

  popup = document.createElement('div');
  popup.style.position = 'absolute';
  popup.style.backgroundColor = 'white';
  popup.style.border = '1px solid #ddd';
  popup.style.borderRadius = '8px';
  popup.style.padding = '5px';
  popup.style.zIndex = '10000';
  popup.style.display = 'none';
  popup.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  popup.style.fontFamily = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
  popup.style.fontSize = '14px';
  popup.style.gap = '4px';
  popup.style.flexDirection = 'row';

  // ✅ Updated menu with new "Create Event" button
  popup.innerHTML = `
    <button data-action="rephrase" style="border:none; background:none; cursor:pointer; padding: 6px 8px; color: #333;">Rephrase</button>
    <button data-action="summarize" style="border:none; background:none; cursor:pointer; padding: 6px 8px; color: #333;">Summarize</button>
    <button data-action="create_event" style="border:none; background:none; cursor:pointer; padding: 6px 8px; color: #333;">Create Event</button>
  `;

  document.body.appendChild(popup);

  popup.addEventListener('click', (event) => {
    const target = event.target as HTMLButtonElement;
    const action = target.dataset.action;

    if (action) {
      const selectedText = window.getSelection()?.toString().trim();
      if (selectedText) {
        console.log(`Action: ${action}, Text: "${selectedText}"`);

        // Send the action and text to the background script
        chrome.runtime.sendMessage({
          type: 'executeAction',
          action,
          text: selectedText
        });

        // Hide the popup after clicking
        if (popup) popup.style.display = 'none';
      }
    }
  });
}

// ===================================================
// PART 2: Show/hide popup based on text selection
// ===================================================
document.addEventListener('mouseup', () => {
  createPopup();
  setTimeout(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 5) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      popup!.style.top = `${rect.bottom + window.scrollY + 5}px`;
      popup!.style.left = `${rect.left + window.scrollX}px`;
      popup!.style.display = 'flex';
    } else {
      if (popup) popup.style.display = 'none';
    }
  }, 10);
});

document.addEventListener('mousedown', (event) => {
  if (popup && !popup.contains(event.target as Node)) {
    popup.style.display = 'none';
  }
});

// ===================================================
// PART 3: Listen for requests from the sidebar
// ===================================================
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "getPageContent") {
    try {
      // Clone the document to avoid altering the live page
      const documentClone = document.cloneNode(true) as Document;

      // Use Readability to parse the cloned document
      const reader = new Readability(documentClone);
      const article = reader.parse();

      if (article && article.textContent) {
        sendResponse({ content: article.textContent });
      } else {
        sendResponse({ content: document.body.innerText });
      }
    } catch (err) {
      console.error("Readability parsing failed:", err);
      sendResponse({ content: document.body.innerText });
    }
  }
  return true; // keep message channel open for async response
});
