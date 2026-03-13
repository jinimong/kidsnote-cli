import type { Command } from 'commander';
import { buildArchive } from '../archive/index.js';

interface ArchiveCommandOptions {
  reports?: string;
  albums?: string;
  days?: string;
  output?: string;
  download?: boolean;
  cookie?: string;
}

export function registerArchiveCommand(program: Command): void {
  program
    .command('archive')
    .description('수집된 JSON 데이터를 날짜별 마크다운으로 아카이빙')
    .option('--reports <path>', '알림장 JSON 파일 경로', './data/reports.json')
    .option('--albums <path>', '앨범 JSON 파일 경로', './data/albums.json')
    .option('--days <path>', '일자별 병합 데이터 저장 경로')
    .option('--output <path>', '출력 디렉토리', './archive')
    .option('--no-download', '미디어 다운로드 건너뜀')
    .option('--cookie <value>', '세션 쿠키 직접 전달')
    .action(async (opts: ArchiveCommandOptions) => {
      try {
        const result = await buildArchive({
          reportsPath: opts.reports,
          albumsPath: opts.albums,
          daysDataPath: opts.days,
          outputDir: opts.output ?? './archive',
          skipDownload: opts.download === false,
          cookie: opts.cookie ?? process.env.KIDSNOTE_COOKIE,
        });

        process.stdout.write(`${JSON.stringify(result)}\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`${JSON.stringify({ error: message })}\n`);
        process.exitCode = 1;
      }
    });
}
