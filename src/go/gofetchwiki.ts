import { execFile, spawn } from 'child_process';
import { Context } from 'koishi';
import * as path from 'path';
import * as fs from 'fs'
import { error } from 'console';


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
  ctx.logger.info("启动fetch_wiki", platform);
  if (!binName) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  const binPath = path.join(__dirname, 'bin', binName);
  if (fs.existsSync(binPath)) {
    try {
      // 添加执行权限
      fs.chmodSync(binPath, 0o755)
      ctx.logger('mcqa').info(`已设置 ${binName} 的执行权限`)
    } catch (error) {
      ctx.logger('mcqa').error(`设置执行权限失败: ${error.message}`)
    }
  } else {
    ctx.logger('mcqa').error(`二进制文件不存在: ${binPath}`)
  }

  ctx.logger.info("fetch_wiki路径:", binName)
  return new Promise((resolve, reject) => {
    const child = spawn(binPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdoutData = ''
    let stderrData = ''

    child.stdout.on('data', (data) => {
      stdoutData += data
    })

    child.stderr.on('data', (data) => {
      stderrData += data
    })

    child.on('close', (code) => {
      if (code !== 0 || stderrData) {
        resolve({
          status: 500,
          content: '',
          error: `执行错误: ${stderrData || '退出码' + code}`
        })
        return
      }


      const result = stdoutData
      resolve({
        status: 200,
        content: result
      })

    })

    child.on('error', (err) => {
      resolve({
        status: 500,
        content: '',
        error: `执行错误: ${err.message}`
      })
    })

    // 通过 stdin 发送 JSON 数据
    child.stdin?.write(JSON.stringify(input));
    child.stdin?.end();
  });
}
