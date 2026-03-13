#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import { registerArchiveCommand } from './commands/archive.js';
import { registerLoginCommand } from './commands/login.js';
import { registerLogoutCommand } from './commands/logout.js';
import { registerNoticeCommand } from './commands/notice.js';
import { registerPluginCommand } from './commands/plugin.js';
import { registerReportCommand } from './commands/report.js';
import { registerUpdateCommand } from './commands/update.js';

config();

const program = new Command();

program.name('kidsnote').description('키즈노트 데이터 수집 CLI').version('0.1.0');

registerLoginCommand(program);
registerReportCommand(program);
registerArchiveCommand(program);
registerNoticeCommand(program);
registerUpdateCommand(program);
registerLogoutCommand(program);
registerPluginCommand(program);

program.parse(process.argv);
