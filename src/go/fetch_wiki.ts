import { execFile } from 'child_process';
import { Context } from 'koishi';
import * as path from 'path';

// 定义输入输出接口
interface WikiInput {
  message: string;
}

interface WikiResponse {
  status: number;
  content: string;
  error?: string;
}

// 多平台二进制文件映射
const PLATFORM_BINARIES: Record<string, string> = {
  'win32': 'fetch_wiki-windows-amd64.exe',
  'darwin': process.arch === 'arm64'
    ? 'fetch_wiki-darwin-arm64'
    : 'fetch_wiki-darwin-amd64',
  'linux': 'fetch_wiki-linux-amd64'
};

export async function fetchWikiContent(ctx: Context, input: WikiInput): Promise<WikiResponse> {
  const platform = process.platform;
  const binName = PLATFORM_BINARIES[platform];

  if (!binName) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const binPath = path.join(__dirname, 'bin', binName);

  return new Promise((resolve, reject) => {
    const child = execFile(binPath, (err, stdout, stderr) => {
      if (err) {
        resolve({
          status: 500,
          content: '',
          error: `执行错误: ${stderr || err.message}`
        });
        return;
      }

      try {
        const result = stdout
        resolve({
          status: 200,
          content: result
        });
      } catch (e) {
        resolve({
          status: 500,
          content: '',
          error: '响应解析失败'
        });
      }
    });

    // 通过 stdin 发送 JSON 数据
    child.stdin?.write(JSON.stringify(input));
    child.stdin?.end();
  });
}
