import { FC } from 'react';

interface Props {
  error?: string;
}

export const InitializationError: FC<Props> = ({ error }) => {
  return (
    <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Application Initialization Error</h1>
      <p>The application failed to start properly.</p>
      {error && (
        <pre style={{ 
          margin: '1rem', 
          padding: '1rem', 
          backgroundColor: '#f8f8f8',
          borderRadius: '4px',
          overflow: 'auto'
        }}>
          {error}
        </pre>
      )}
      <button onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  );
};
