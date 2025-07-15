import { Context, Schema } from 'koishi'
import axios from 'axios'
import { JSDOM } from 'jsdom'
import { fetchWikiContent as fetchWikiRawContent } from "./go/gofetchwiki"
import { processHtmlWithJSDOM } from './htmlPro'
import { fetchwiki } from './fetchwiki'

export const name = 'mcqa'

export interface Config {
  apiKey: string
  model?: string
  temperature?: number
}

export const Config: Schema<Config> = Schema.object({
  apiKey: Schema.string().required().description('DeepSeek API密钥'),
  model: Schema.string().default('deepseek-chat').description('模型名称'),
  temperature: Schema.number().min(0).max(2).default(0.7).description('生成温度')
})



// 关键词提取提示词模板
const KEYWORD_PROMPT = `请从以下Minecraft问题中提取3-4个最核心的中文关键词（如游戏版本、生物名、物品名等）。要求：
- 只返回关键词本身，不要解释，关键词之间用空格分开
- 关键词必须是游戏中的具体实体、机制或概念
- 选择Minecraft Wiki中存在的条目名称
- 例如：铜有什么用 -> 铜 铜矿 望远镜

问题：{question}`

const systemPrompt = `你是一个专业的Minecraft游戏助手，请严格遵循：
1. 回答必须基于Minecraft Wiki提供的信息
2. 涉及游戏机制需注明适用版本（如Java 1.20/Bedrock 1.20）
3. 涉及合成配方需列出精确材料（数量+名称）
4. 涉及生物行为需注明难度模式
5. 使用自然对话语气（16岁女孩风格），但保持信息准确性
6. 当Wiki信息冲突时优先采用最新正式版内容`
async function extractKeywords(ctx: Context, question: string, config: Config): Promise<string[]> {
  try {
    // 构造关键词提取提示词
    const keywordPrompt = KEYWORD_PROMPT.replace('{question}', question)

    // 调用DeepSeek API提取关键词
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: config.model,
      messages: [{ role: 'user', content: keywordPrompt }],
      temperature: 0.3, // 使用较低温度保证稳定性
      max_tokens: 30
    }, {
      headers: { Authorization: `Bearer ${config.apiKey}` }
    })

    // 解析返回的关键词
    const keywordsText = response.data.choices[0].message.content as string
    return keywordsText.split(' ').map(k => k.trim()).filter(Boolean)
  } catch (error) {
    console.error('关键词提取失败:', error)
    return []
  }
}


export function apply(ctx: Context, config: Config) {
  // 注册mcqa命令
  ctx.command('q <question:text>', 'Minecraft问题解答')
    .action(async ({ session }, question) => {
      if (!question) return '请输入问题'

      try {
        // 使用DeepSeek提取关键词
        const keywords = await extractKeywords(ctx, question, config)
        keywords.push("")
        ctx.logger('mcqa').info(`提取的关键词: ${keywords.join(', ')}`)

        // 获取Wiki内容
        let wikiContexts = ''
        try {
          const wikiPromises = keywords.map(keyword => fetchwiki(ctx, keyword))
          const wikiResults = await Promise.all(wikiPromises)

          for (let i = 0; i < keywords.length; i++) {
            const keyWikiContext = `[${keywords[i]}]: ${wikiResults[i]}`
            ctx.logger('mcqa').info(`Wiki内容: ${keyWikiContext.substring(0, 100)}...`)
            wikiContexts += `${keyWikiContext}\n\n`
          }
        } catch (error) {
          ctx.logger.info(`Wiki获取失败: ${error}`)
        }

        const fullPrompt = `请根据提供的Wiki信息回答Minecraft问题：
### 回答规则：
1. 涉及游戏机制 → 说明[版本]和[平台]
2. 涉及合成配方 → 格式: "合成表: 3x木头 + 2x木棍"
3. 涉及生物行为 → 注明[难度模式]
4. 涉及红石 → 只说明功能原理，不说明电路图
5. 使用自然对话但保持专业

### Wiki参考信息：
${wikiContexts.trim()}

### 问题：
在Minecraft中，${question}`

        // 调用DeepSeek API
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
          model: config.model,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: fullPrompt }],
          temperature: config.temperature
        }, {
          headers: { Authorization: `Bearer ${config.apiKey}` }
        })

        return response.data.choices[0].message.content
      } catch (error) {
        ctx.logger('mcqa').error('处理失败:', error)
        return '问答服务暂时不可用，请稍后再试'
      }
    })
}
