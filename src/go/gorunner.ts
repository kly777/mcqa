// goRunner.js
const { execFile } = require('child_process');
const path = require('path');

// 多平台可执行文件映射
const PLATFORM_BINARIES = {
  'win32': 'fetch_wiki-windows-amd64.exe',
  'darwin': process.arch === 'arm64' ? 'fetch_wiki-darwin-arm64' : 'fetch_wiki-darwin-amd64',
  'linux': 'fetch_wiki-linux-amd64'
};

export async function fetch_wiki(input: string) {
  const platform = process.platform;
  const binName = PLATFORM_BINARIES[platform];

  if (!binName) throw new Error(`Unsupported platform: ${platform}`);

  const binPath = path.join(__dirname, 'bin', binName);
  return new Promise((resolve, reject) => {
    const child = execFile(binPath, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error("Invalid JSON response"));
      }
    });

    // 通过 stdin 发送 JSON 数据
    child.stdin.write(JSON.stringify({ message: input }));
    child.stdin.end();
  });
}
