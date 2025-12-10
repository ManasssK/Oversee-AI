import React, { useState } from 'react';

type Template = 'none' | 'formal_email' | 'tweet_ideas';

export function ComposeView() {
  const [template, setTemplate] = useState<Template>('none');
  const [context, setContext] = useState<any>({});
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setContext({ ...context, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (template === 'none') return;
    
    setIsLoading(true);
    setResult('');

    // Call your backend stream function
    const response = await fetch('http://localhost:3001/api/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, context }),
    });

    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6));
          if (data.chunk) {
            setResult(prev => prev + data.chunk);
          }
        }
      }
    }
    setIsLoading(false);
  };

  const renderTemplateForm = () => {
    switch (template) {
      case 'formal_email':
        return (
          <>
            <input name="to" type="email" placeholder="Recipient's Email" onChange={handleInputChange} />
            <input name="subject" type="text" placeholder="Subject" onChange={handleInputChange} />
            <textarea name="points" placeholder="Key points to include (one per line)" onChange={handleInputChange}></textarea>
          </>
        );
      case 'tweet_ideas':
        return (
          <>
            <input name="topic" type="text" placeholder="Topic (e.g., 'space exploration')" onChange={handleInputChange} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="compose-view">
      <h2>Content Composer</h2>
      <form onSubmit={handleSubmit} className="compose-form">
        <select value={template} onChange={(e) => setTemplate(e.target.value as Template)}>
          <option value="none" disabled>Select a template...</option>
          <option value="formal_email">Formal Email</option>
          <option value="tweet_ideas">Tweet Ideas</option>
        </select>
        
        {renderTemplateForm()}

        {template !== 'none' && (
          <button type="submit" disabled={isLoading}>{isLoading ? 'Generating...' : 'Generate'}</button>
        )}
      </form>
      
      {result && (
        <div className="result-box">
          <pre>{result}</pre>
        </div>
      )}
    </div>
  );
}