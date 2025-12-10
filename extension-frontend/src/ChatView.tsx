// src/ChatView.tsx
import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import Papa from 'papaparse';
import mammoth from 'mammoth';
import './Sidebar.css';

interface Message {
  author: 'ai' | 'user';
  text: string;
}

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Chat container ref for scroll control
  const listRef = useRef<HTMLDivElement>(null);
  // Track whether the user is near the bottom; only then auto-scroll
  const isAutoScrollRef = useRef<boolean>(true);

  // Scroll tracking
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onScroll = () => {
      const diff = el.scrollHeight - el.scrollTop - el.clientHeight;
      isAutoScrollRef.current = diff < 40;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll to bottom only if user is already near bottom
  useEffect(() => {
    if (isAutoScrollRef.current && listRef.current) {
      const el = listRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Load history + listen for storage changes
  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('chat_history')
          .select('messages')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error fetching history:', error);
        } else if (data && data.length > 0) {
          setMessages(data[0].messages);
        } else {
          setMessages([{ author: 'ai' as const, text: 'Hello! How can I help you today?' }]);
        }
      }
      setIsLoading(false);
    };

    fetchHistory();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.lastAiMessage && changes.lastAiMessage.newValue) {
        const newMessage = changes.lastAiMessage.newValue as Message;
        setMessages(prev => [...prev, newMessage]);
        chrome.storage.local.remove('lastAiMessage');
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // ---- File Upload ----
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf';
    let question = 'Summarize this document.';

    if (!isPdf) {
      const userQuestion = prompt(`What would you like to know about ${file.name}?`);
      if (!userQuestion) {
        event.target.value = '';
        return;
      }
      question = userQuestion;
    }

    setIsLoading(true);

    const baseMessages = [...messages, { author: 'user' as const, text: `${question} (${file.name})` }];
    setMessages([...baseMessages, { author: 'ai' as const, text: '' }]);

    let fullReply = '';
    try {
      let response: Response;

      if (isPdf) {
        const formData = new FormData();
        formData.append('pdf', file);
        response = await fetch('http://localhost:3001/api/summarize-pdf', {
          method: 'POST',
          body: formData,
        });
      } else {
        let fileText = '';
        if (file.name.toLowerCase().endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          fileText = result.value || '';
        } else if (file.name.toLowerCase().endsWith('.csv')) {
          fileText = await new Promise<string>((resolve, reject) => {
            Papa.parse(file, {
              complete: (results) => resolve(JSON.stringify(results.data)),
              error: (err) => reject(err),
            });
          });
        } else {
          fileText = await file.text();
        }

        response = await fetch('http://localhost:3001/api/analyze-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, context: fileText }),
        });
      }

      if (!response.ok || !response.body) throw new Error(`Server error: ${response.statusText}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.substring(6));
            if (data?.chunk) {
              fullReply += data.chunk;
              setMessages(prev =>
                prev.map((msg, i) =>
                  i === prev.length - 1 ? { ...msg, text: msg.text + data.chunk } : msg
                )
              );
            }
          } catch {
            // ignore malformed line
          }
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const finalMessages = [...baseMessages, { author: 'ai' as const, text: fullReply }];
        await fetch('http://localhost:3001/api/save_chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, messages: finalMessages }),
        });
      }
    } catch (err: any) {
      console.error('Error processing file:', err?.message || err);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { author: 'ai' as const, text: 'Sorry, I could not process that file.' },
      ]);
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  // ---- Chat Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { author: 'user' as const, text: input };
    const baseMessages = [...messages, userMessage];
    setMessages([...baseMessages, { author: 'ai' as const, text: '' }]);

    const currentInput = input;
    setInput('');
    setIsLoading(true);

    let fullReply = '';
    try {
      let pageContent = '';
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' });
          if (response && response.content) pageContent = response.content;
        }
      } catch (err: any) {
        console.warn('Could not get page content.', err?.message || err);
      }

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, context: pageContent }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.substring(6));
            if (data?.chunk) {
              fullReply += data.chunk;
              setMessages(prev =>
                prev.map((msg, i) =>
                  i === prev.length - 1 ? { ...msg, text: msg.text + data.chunk } : msg
                )
              );
            }
          } catch {
            // ignore malformed line
          }
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const finalMessages = [...baseMessages, { author: 'ai' as const, text: fullReply }];
        await fetch('http://localhost:3001/api/save_chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, messages: finalMessages }),
        });
      }
    } catch (error: any) {
      console.error('Error processing request:', error?.message || error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="message-list" ref={listRef}>
        {isLoading ? (
          <div className="loading-spinner"></div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message ${msg.author}`}>
              {msg.text}
            </div>
          ))
        )}
      </div>

      <form className="message-input-form" onSubmit={handleSubmit}>
        <label htmlFor="file-upload" className="upload-btn" title="Upload file">📎</label>
        <input
          type="file"
          id="file-upload"
          accept=".pdf,.txt,.md,.csv,.docx"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this page..."
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </>
  );
}
