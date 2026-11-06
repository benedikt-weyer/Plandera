import { formatApiErrorMessage } from '@/utils/api/api-error';

describe('formatApiErrorMessage', () => {
  it('turns a failed login into a readable sentence', () => {
    const body = JSON.stringify({
      error: 'Authentication failed',
      details: 'Authentication error: invalid email or password',
    });
    expect(formatApiErrorMessage(401, body)).toBe('Invalid email or password.');
  });

  it('strips the validation prefix', () => {
    const body = JSON.stringify({
      error: 'Validation failed',
      details: 'Validation error: email is already registered',
    });
    expect(formatApiErrorMessage(400, body)).toBe('Email is already registered.');
  });

  it('falls back to the error category when there are no details', () => {
    expect(formatApiErrorMessage(404, JSON.stringify({ error: 'Resource not found' }))).toBe(
      'Resource not found.',
    );
  });

  it('does not expose server error details', () => {
    const body = JSON.stringify({
      error: 'Database error occurred',
      details: 'Database error: connection to 10.0.0.5 refused',
    });
    expect(formatApiErrorMessage(500, body)).toBe(
      'Something went wrong on the server. Please try again later.',
    );
  });

  it('handles non-JSON bodies', () => {
    expect(formatApiErrorMessage(502, '<html>Bad gateway</html>')).toContain('server');
    expect(formatApiErrorMessage(403, 'Forbidden')).toBe('Request failed (HTTP 403).');
  });
});
