import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:readline', () => {
  const questionFn = vi.fn();
  const closeFn = vi.fn();
  return {
    createInterface: vi.fn(() => ({
      question: questionFn,
      close: closeFn,
    })),
    __questionFn: questionFn,
    __closeFn: closeFn,
  };
});

const { __questionFn: questionFn } = (await import('node:readline')) as any;
const { promptConfirm, promptPassword, promptText } = await import('../../src/utils/prompt.js');

describe('promptText', () => {
  beforeEach(() => {
    questionFn.mockReset();
  });

  it('기본값 없이 사용자 입력을 반환한다', async () => {
    questionFn.mockImplementation((_msg: string, cb: (answer: string) => void) =>
      cb('user@test.com'),
    );

    const result = await promptText('아이디');
    expect(result).toBe('user@test.com');
    expect(questionFn).toHaveBeenCalledWith('아이디: ', expect.any(Function));
  });

  it('기본값이 있으면 프롬프트에 표시한다', async () => {
    questionFn.mockImplementation((_msg: string, cb: (answer: string) => void) => cb(''));

    const result = await promptText('아이디', 'saved@test.com');
    expect(result).toBe('saved@test.com');
    expect(questionFn).toHaveBeenCalledWith('아이디 (saved@test.com): ', expect.any(Function));
  });

  it('사용자 입력이 있으면 기본값 대신 사용한다', async () => {
    questionFn.mockImplementation((_msg: string, cb: (answer: string) => void) =>
      cb('new@test.com'),
    );

    const result = await promptText('아이디', 'saved@test.com');
    expect(result).toBe('new@test.com');
  });

  it('공백 입력은 기본값으로 처리한다', async () => {
    questionFn.mockImplementation((_msg: string, cb: (answer: string) => void) => cb('   '));

    const result = await promptText('아이디', 'saved@test.com');
    expect(result).toBe('saved@test.com');
  });

  it('기본값도 없고 빈 입력이면 빈 문자열을 반환한다', async () => {
    questionFn.mockImplementation((_msg: string, cb: (answer: string) => void) => cb(''));

    const result = await promptText('아이디');
    expect(result).toBe('');
  });
});

describe('promptConfirm', () => {
  beforeEach(() => {
    questionFn.mockReset();
  });

  it('기본값 yes일 때 빈 입력은 true를 반환한다', async () => {
    questionFn.mockImplementation((_msg: string, cb: (answer: string) => void) => cb(''));

    const result = await promptConfirm('저장할까요?', true);
    expect(result).toBe(true);
    expect(questionFn).toHaveBeenCalledWith('저장할까요? (Y/n): ', expect.any(Function));
  });

  it('기본값 no일 때 빈 입력은 false를 반환한다', async () => {
    questionFn.mockImplementation((_msg: string, cb: (answer: string) => void) => cb(''));

    const result = await promptConfirm('저장할까요?', false);
    expect(result).toBe(false);
    expect(questionFn).toHaveBeenCalledWith('저장할까요? (y/N): ', expect.any(Function));
  });

  it('y 입력은 true를 반환한다', async () => {
    questionFn.mockImplementation((_msg: string, cb: (answer: string) => void) => cb('y'));

    const result = await promptConfirm('저장할까요?', false);
    expect(result).toBe(true);
  });

  it('yes 입력은 true를 반환한다', async () => {
    questionFn.mockImplementation((_msg: string, cb: (answer: string) => void) => cb('yes'));

    const result = await promptConfirm('저장할까요?', true);
    expect(result).toBe(true);
  });

  it('n 입력은 false를 반환한다', async () => {
    questionFn.mockImplementation((_msg: string, cb: (answer: string) => void) => cb('n'));

    const result = await promptConfirm('저장할까요?', true);
    expect(result).toBe(false);
  });

  it('N 입력은 false를 반환한다', async () => {
    questionFn.mockImplementation((_msg: string, cb: (answer: string) => void) => cb('N'));

    const result = await promptConfirm('저장할까요?', true);
    expect(result).toBe(false);
  });
});

describe('promptPassword', () => {
  const originalIsTTY = process.stdin.isTTY;
  const originalSetRawMode = process.stdin.setRawMode;
  const originalResume = process.stdin.resume;
  const originalPause = process.stdin.pause;

  beforeEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    process.stdin.setRawMode = vi.fn();
    process.stdin.resume = vi.fn();
    process.stdin.pause = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    process.stdin.setRawMode = originalSetRawMode;
    process.stdin.resume = originalResume;
    process.stdin.pause = originalPause;
    vi.restoreAllMocks();
  });

  it('입력 글자수를 출력하지 않고 비밀번호를 반환한다', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    const promise = promptPassword('비밀번호');

    process.stdin.emit('data', 'a');
    process.stdin.emit('data', 'b');
    process.stdin.emit('data', '\n');

    await expect(promise).resolves.toBe('ab');
    expect(writeSpy).toHaveBeenCalledWith('비밀번호: ');
    expect(writeSpy).toHaveBeenCalledWith('\n');
    expect(writeSpy).not.toHaveBeenCalledWith('*');
    expect(writeSpy).not.toHaveBeenCalledWith('\b \b');
    expect(process.stdin.setRawMode).toHaveBeenCalledWith(true);
    expect(process.stdin.setRawMode).toHaveBeenCalledWith(false);
  });

  it('TTY가 아니면 에러를 던진다', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });

    await expect(promptPassword('비밀번호')).rejects.toThrow(
      '비밀번호 입력은 터미널에서만 가능합니다.',
    );
  });
});
