import  { useState, useEffect } from 'react';

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string };
}

export function EventsView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Get the auth token first
    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
      if (!token) {
        setError("Please connect your Google Account in Settings to see events.");
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch('http://localhost:3001/api/get-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await response.json();
        if (response.ok) {
          setEvents(data);
        } else {
          throw new Error(data.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (isLoading) return <div className="loading-spinner"></div>;
  if (error) return <div className="view-error">{error}</div>;

  return (
    <div className="events-view">
      <h2>Upcoming Events</h2>
      {events.length > 0 ? (
        <ul className="event-list">
          {events.map(event => (
            <li key={event.id} className="event-item">
              <span className="event-title">{event.summary}</span>
              <span className="event-time">{formatDate(event.start.dateTime)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No upcoming events in the next 7 days.</p>
      )}
    </div>
  );
}