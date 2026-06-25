const OpenAI = require('openai');
const config = require('../config');

const client = new OpenAI({
  apiKey: config.llm.apiKey,
  baseURL: config.llm.baseURL,
});

async function callLLM(prompt) {
  try {
    const resp = await client.chat.completions.create({
      model: config.llm.model,
      messages: [
        {
          role: 'system',
          content: '你是高考志愿填报专家。请用中文回答，使用 Markdown 格式输出，善用标题、表格、列表等格式让内容清晰易读。给出专业、实用的分析和建议。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });
    return resp.choices[0].message.content.trim();
  } catch (e) {
    console.error('LLM 调用失败:', e.message);
    return `AI 分析暂时不可用: ${e.message}`;
  }
}

async function callLLMJson(prompt) {
  try {
    const resp = await client.chat.completions.create({
      model: config.llm.model,
      messages: [
        {
          role: 'system',
          content: '你是数据分析助手。请只返回 JSON 格式数据，不要其他内容。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });
    let text = resp.choices[0].message.content.trim();
    if (text.startsWith('```')) {
      text = text.split('\n', 1)[1].rsplit('```', 1)[0].trim();
    }
    return JSON.parse(text);
  } catch (e) {
    console.error('LLM JSON 调用失败:', e.message);
    return null;
  }
}

function buildPrompt(score, province, subject, schools) {
  const lines = [];
  const mapping = [
    ['rush', '冲'],
    ['stable', '稳'],
    ['safe', '保'],
  ];

  for (const [key, label] of mapping) {
    for (const s of schools[key] || []) {
      const tags = s.tags.length ? s.tags.join('、') : '无';
      lines.push(
        `  [${label}] ${s.name}（${s.province}）| 主管:${s.department} | 特色:${tags} | 近年最低分:${s.avg_min_score} | 分差:${s.diff > 0 ? '+' : ''}${s.diff}`
      );
    }
  }

  return `考生信息：${province}省，${subject}类，高考分数 ${score} 分

匹配到的高校列表：
${lines.join('\n')}

请使用 Markdown 格式，从以下维度进行分析：

## 录取概率分析
对冲/稳/保三档各给出总体录取概率判断

## 就业前景
推荐的学校和专业的就业率、就业方向

## 专业建议
根据分数推荐适合的专业方向

## 城市因素
学校所在城市的发展前景和生活成本

## 填报策略
冲稳保的填报顺序和注意事项

## 综合建议
给出 3-5 条核心建议`;
}

async function getIndustries() {
  return [
    { id: 'tech', name: '互联网/IT/科技', icon: '💻', majors: ['计算机科学与技术', '软件工程', '人工智能', '数据科学', '信息安全', '电子信息工程'] },
    { id: 'finance', name: '金融/经济/会计', icon: '💰', majors: ['金融学', '经济学', '会计学', '财务管理', '国际经济与贸易', '保险学'] },
    { id: 'medical', name: '医学/药学/护理', icon: '🏥', majors: ['临床医学', '口腔医学', '药学', '护理学', '中医学', '医学影像学'] },
    { id: 'engineering', name: '工程/制造/建筑', icon: '🏗️', majors: ['机械工程', '土木工程', '电气工程', '建筑学', '自动化', '材料科学'] },
    { id: 'law', name: '法律/政治/公共管理', icon: '⚖️', majors: ['法学', '政治学', '行政管理', '社会学', '公共事业管理', '知识产权'] },
    { id: 'education', name: '教育/师范/心理', icon: '📚', majors: ['教育学', '学前教育', '小学教育', '心理学', '汉语言文学', '英语'] },
    { id: 'art', name: '艺术/设计/传媒', icon: '🎨', majors: ['视觉传达设计', '环境设计', '动画', '广播电视学', '新闻学', '数字媒体艺术'] },
    { id: 'science', name: '理学/数学/物理', icon: '🔬', majors: ['数学与应用数学', '物理学', '化学', '生物科学', '统计学', '应用物理学'] },
    { id: 'agriculture', name: '农学/林学/环境', icon: '🌱', majors: ['农学', '林学', '环境科学', '食品科学', '园艺', '动物医学'] },
    { id: 'logistics', name: '物流/电商/供应链', icon: '📦', majors: ['物流管理', '电子商务', '供应链管理', '市场营销', '国际贸易', '信息管理'] },
  ];
}

async function getSchoolMajorsByIndustry(schoolName, industryName, majors) {
  const prompt = `请查询 ${schoolName} 在以下专业方向的情况：${majors.join('、')}

要求：
1. 标注该校哪些专业是优势专业/重点学科
2. 提供这些专业的大致录取分数线
3. 简要说明就业前景

请返回 JSON 格式：
{
  "school": "${schoolName}",
  "industry": "${industryName}",
  "majors": [
    {"name": "计算机科学与技术", "is_strong": true, "score_range": "620-650", "employment": "就业率98%，主要去向互联网大厂"},
    {"name": "软件工程", "is_strong": false, "score_range": "610-640", "employment": "就业率95%"}
  ]
}

只返回 JSON，不要其他内容。如果无法确认具体数据，score_range 和 employment 可以填写"待确认"。`;

  return await callLLMJson(prompt);
}

module.exports = { callLLM, callLLMJson, buildPrompt, getIndustries, getSchoolMajorsByIndustry };
