import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let answers: string[] = [];

const closeMock = vi.fn();
const createInterfaceMock = vi.fn(() => ({
  question: (question: string, cb: (answer: string) => void) => {
    cb(answers.shift() ?? '');
  },
  close: closeMock,
}));

vi.mock('readline', () => ({
  createInterface: createInterfaceMock,
}));

describe('readline helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    answers = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prompt() trims input and closes the interface', async () => {
    answers.push('  hello  ');

    const { prompt } = await import('../readline.js');
    await expect(prompt('Question: ')).resolves.toBe('hello');

    expect(createInterfaceMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('confirm() returns true for y/yes (case-insensitive)', async () => {
    const { confirm } = await import('../readline.js');

    answers.push('Y');
    await expect(confirm('Proceed?')).resolves.toBe(true);

    answers.push(' yes ');
    await expect(confirm('Proceed?')).resolves.toBe(true);
  });

  it('confirm() returns false for other values', async () => {
    const { confirm } = await import('../readline.js');

    answers.push('n');
    await expect(confirm('Proceed?')).resolves.toBe(false);

    answers.push('nope');
    await expect(confirm('Proceed?')).resolves.toBe(false);
  });

  it('selectFromList() retries on invalid input and returns the selected option', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // invalid -> valid (select option #2)
    answers.push('0');
    answers.push('2');

    const { selectFromList } = await import('../readline.js');
    await expect(selectFromList('Pick one:', ['a', 'b', 'c'])).resolves.toBe('b');

    const combined = logSpy.mock.calls.map(([line]) => String(line)).join('\n');
    expect(combined).toContain('Invalid selection. Please try again.');
    expect(closeMock).toHaveBeenCalledTimes(2);
  });
});

