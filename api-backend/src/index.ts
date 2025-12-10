// api-backend/src/index.ts

import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import pdf from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const app = express();
const port = 3001;

// --- Supabase admin client ---
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// --- Gemini AI client ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- File Upload (Multer) ---
const upload = multer({ storage: multer.memoryStorage() });

// --- Helper: Streaming responses ---
async function streamResponse(prompt: string, res: Response) {
  try {
    const result = await model.generateContentStream(prompt);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error("Error during AI stream:", error);
    res.status(500).write('data: {"error": "AI stream failed"}\n\n');
    res.end();
  }
}

// ==================================================
// ROUTE 1: Chat endpoint
// ==================================================
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, context } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const prompt = `
    You are Omni, a helpful AI assistant. Analyze the context from the user's webpage and answer their question.

    CONTEXT: """${context?.substring(0, 15000) || ""}"""

    USER'S QUESTION: "${message}"
  `;

  streamResponse(prompt, res);
});

// ==================================================
// ROUTE 2: Popup menu actions (Rephrase, Summarize)
// ==================================================
app.post('/api/action', async (req: Request, res: Response) => {
  const { action, text } = req.body;

  if (!action || !text) {
    return res.status(400).json({ error: 'Action and text are required' });
  }

  let prompt = '';
  switch (action) {
    case 'rephrase':
      prompt = `Rephrase the following text to be more clear and concise: "${text}"`;
      break;
    case 'summarize':
      prompt = `Summarize the following text in one key sentence: "${text}"`;
      break;
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }

  streamResponse(prompt, res);
});

// ==================================================
// ROUTE 3: Save chat history
// ==================================================
app.post('/api/save_chat', async (req: Request, res: Response) => {
  try {
    const { userId, messages } = req.body;
    if (!userId || !messages) {
      return res.status(400).json({ error: 'User ID and messages are required' });
    }

    const { error } = await supabaseAdmin
      .from('chat_history')
      .upsert({ user_id: userId, messages }, { onConflict: 'user_id' });

    if (error) throw error;

    res.status(200).json({ success: true, message: 'Chat saved.' });
  } catch (error) {
    console.error('Error saving chat:', error);
    res.status(500).json({ success: false, error: 'Failed to save chat history.' });
  }
});

// ==================================================
// ROUTE 4: Summarize PDF
// ==================================================
app.post('/api/summarize-pdf', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }

    const data = await pdf(req.file.buffer);
    const pdfText = data.text;

    const prompt = `
      Please provide a concise summary of the following document:
      
      DOCUMENT TEXT:
      """
      ${pdfText.substring(0, 15000)}
      """
      
      SUMMARY:
    `;

    streamResponse(prompt, res);

  } catch (error) {
    console.error("Error processing PDF:", error);
    res.status(500).json({ error: 'Failed to summarize PDF.' });
  }
});

// ==================================================
// ROUTE 5: Compose endpoint
// ==================================================
app.post('/api/compose', async (req: Request, res: Response) => {
  try {
    const { template, context } = req.body;
    if (!template || !context) {
      return res.status(400).json({ error: 'Template and context are required.' });
    }

    let prompt = '';
    switch (template) {
      case 'formal_email':
        prompt = `
          Write a formal email with the following details:
          To: ${context.to}
          From: A professional
          Subject: ${context.subject}
          
          Key points to include:
          - ${context.points}

          The tone should be professional, respectful, and clear.
        `;
        break;
      case 'tweet_ideas':
        prompt = `
          Generate 5 creative and engaging tweet ideas about the following topic: "${context.topic}".
          The tweets should be short, punchy, and include relevant hashtags.
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid template type.' });
    }

    streamResponse(prompt, res);
  } catch (error) {
    console.error("Error in compose endpoint:", error);
    res.status(500).json({ error: 'Failed to generate content.' });
  }
});

// ==================================================
// ROUTE 6: Generic Text Analysis
// ==================================================
app.post('/api/analyze-text', async (req: Request, res: Response) => {
  try {
    const { question, context } = req.body;
    if (!question || !context) {
      return res.status(400).json({ error: 'Question and context are required.' });
    }

    const prompt = `
      Analyze the following document context and answer the user's question.
      
      DOCUMENT CONTEXT:
      """
      ${context.substring(0, 15000)}
      """
      
      USER'S QUESTION: "${question}"
      
      ANALYSIS:
    `;
    
    streamResponse(prompt, res);

  } catch (error) {
    console.error("Error in analyze-text endpoint:", error);
    res.status(500).json({ error: 'Failed to analyze text.' });
  }
});

// ==================================================
// ROUTE 7: Google Calendar Event Creation
// ==================================================
app.post('/api/create-event', async (req: Request, res: Response) => {
  try {
    const { token, text } = req.body;
    if (!token || !text) {
      return res.status(400).json({ error: 'Auth token and text are required' });
    }

    const prompt = `
      From the following text, extract an event title and a start time in full ISO 8601 format (e.g., 2025-08-23T16:00:00+05:30).
      Today's date is August 23, 2025. The user is in Hyderabad, India (time zone Asia/Kolkata, UTC+05:30).
      If no time is specified, assume a reasonable time like 10:00 AM.
      Respond ONLY with a single JSON object containing "title" and "startTime".
      
      TEXT: "${text}"
    `;

    const geminiResult = await model.generateContent(prompt);
    const geminiResponse = await geminiResult.response;
    const rawText = geminiResponse.text();
    const jsonMatch = rawText.match(/\{.*\}/s);

    if (!jsonMatch) throw new Error("AI did not return valid JSON.");

    const eventDetails = JSON.parse(jsonMatch[0]);

    const startTime = new Date(eventDetails.startTime);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: eventDetails.title,
        start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Kolkata' },
        end: { dateTime: endTime.toISOString(), timeZone: 'Asia/Kolkata' },
      }),
    });

    if (!calendarResponse.ok) {
      const errorBody = await calendarResponse.text();
      console.error("Google API Error:", errorBody);
      throw new Error(`Google API failed: ${calendarResponse.statusText}`);
    }

    const googleEvent = await calendarResponse.json();
    res.status(200).json({ success: true, message: `Event '${googleEvent.summary}' created successfully!` });

  } catch (error) {
    console.error("Error creating Google Calendar event:", error);
    res.status(500).json({ error: 'Failed to create event.' });
  }
});

// ==================================================
// ROUTE 8: Google Calendar Event Fetching (NEW)
// ==================================================
app.post('/api/get-events', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Auth token is required.' });
    }

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!calendarResponse.ok) {
      throw new Error(`Google API failed: ${calendarResponse.statusText}`);
    }

    const eventData = await calendarResponse.json();
    res.status(200).json(eventData.items);

  } catch (error) {
    console.error("Error fetching Google Calendar events:", error);
    res.status(500).json({ error: 'Failed to fetch events.' });
  }
});

// ==================================================
// Start server
// ==================================================
app.listen(port, () => {
  console.log(`🚀 Server listening at http://localhost:${port}`);
});
