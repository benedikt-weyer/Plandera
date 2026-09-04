
import { parseDurationFromContent } from '../../utils/can-do-list/duration-parser';

describe('Duration Parser', () => {
  const testCases = [
    { input: 'Buy groceries #d15', expected: { content: 'Buy groceries', duration: 15 } },
    { input: 'Meeting with team #d15m', expected: { content: 'Meeting with team', duration: 15 } },
    { input: 'Complete project #d1h', expected: { content: 'Complete project', duration: 60 } },
    { input: 'Study session #d1h15m', expected: { content: 'Study session', duration: 75 } },
    { input: 'Work on presentation #d1h15', expected: { content: 'Work on presentation', duration: 75 } },
    { input: 'Long project #d3h', expected: { content: 'Long project', duration: 180 } },
    { input: 'Simple task', expected: { content: 'Simple task', duration: undefined } },
    { input: '#d30 Important meeting', expected: { content: 'Important meeting', duration: 30 } },
    { input: 'Call client #d45m about the proposal', expected: { content: 'Call client about the proposal', duration: 45 } },
  ];

  test.each(testCases)('should parse "$input" correctly', ({ input, expected }) => {
    const result = parseDurationFromContent(input);
    expect(result.content).toBe(expected.content);
    expect(result.duration).toBe(expected.duration);
  });

  it('should handle edge cases', () => {
    // Multiple duration tags - should remove all of them and take the first valid one
    const result1 = parseDurationFromContent('Task #d15 and #d30');
    expect(result1.content).toBe('Task and');
    expect(result1.duration).toBe(15);

    // Invalid duration format
    const result2 = parseDurationFromContent('Task #dabc');
    expect(result2.content).toBe('Task #dabc');
    expect(result2.duration).toBeUndefined();

    // Empty content
    const result3 = parseDurationFromContent('');
    expect(result3.content).toBe('');
    expect(result3.duration).toBeUndefined();
  });
});
