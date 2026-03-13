import { createInterface } from 'node:readline';

export function promptText(message: string, defaultValue?: string): Promise<string> {
  return new Promise((resolve) => {
    const suffix = defaultValue ? ` (${defaultValue})` : '';
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${message}${suffix}: `, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultValue || '');
    });
  });
}

export function promptPassword(message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('비밀번호 입력은 터미널에서만 가능합니다.'));
      return;
    }

    process.stdout.write(`${message}: `);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const chars: string[] = [];

    const onData = (key: string): void => {
      if (key === '\r' || key === '\n' || key === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(chars.join(''));
        return;
      }

      if (key === '\u0003') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        reject(new Error('사용자가 입력을 취소했습니다.'));
        return;
      }

      if (key === '\u007F' || key === '\b') {
        if (chars.length > 0) {
          chars.pop();
        }
        return;
      }

      chars.push(key);
    };

    process.stdin.on('data', onData);
  });
}

export function promptConfirm(message: string, defaultYes = true): Promise<boolean> {
  return new Promise((resolve) => {
    const hint = defaultYes ? 'Y/n' : 'y/N';
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${message} (${hint}): `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === '') {
        resolve(defaultYes);
      } else {
        resolve(trimmed === 'y' || trimmed === 'yes');
      }
    });
  });
}
