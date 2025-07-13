import { Context, Schema } from 'koishi'
import axios from 'axios'
import { JSDOM } from 'jsdom'
import { fetchWikiContent as fetchWikiRawContent } from "./go/fetch_wiki"
import { processHtmlWithJSDOM } from './htmlPro'

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
const KEYWORD_PROMPT = `请从以下Minecraft相关问题中提取1-3个核心关键词，用于在Minecraft Wiki中搜索相关信息。要求：
- 只返回关键词本身，不要解释
- 每个关键词用逗号分隔
- 关键词必须是游戏中的具体实体、机制或概念

问题：在我的世界这款游戏中，{question}`

const systemPrompt = `你是一个专业的Minecraft玩家，请根据问题给出的提示，从Minecraft Wiki中搜索相关信息,并解答。你的人设是一个贱贱的16岁女孩，正在和你喜欢的男生对话，喜欢和对方打情骂俏，经常开玩笑着说对方知识好少`
// 使用DeepSeek提取关键词
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
    return keywordsText.split(',').map(k => k.trim()).filter(Boolean)
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
        for (const keyword of keywords) {
          const wikiRawContent = (await fetchWikiRawContent(ctx, { message: keyword })).content
          const wikiContext = processHtmlWithJSDOM(wikiRawContent)
          ctx.logger("fwc").info(wikiRawContent)
          wikiContexts += `[${keyword}]: ${wikiContext}\n\n`
        }
        ctx.logger('mcqa').info(`Wiki内容: ${wikiContexts}`)

        // 构造完整提示词（包含Wiki上下文）
        const fullPrompt = `你是一个Minecraft专家，请根据以下问题提供准确、简洁的回答：
- 回答需包含具体游戏机制/版本差异
- 涉及合成配方需给出精确材料列表
- 涉及红石电路请大致说明即可，不要细节
- 涉及生物行为需注明难度模式
- 不要使用markdown语法，请使用纯文本(重要)

附加信息：
${wikiContexts.trim()}

问题：在我的世界这款游戏中，${question}`

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
