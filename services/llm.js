const OpenAI = require('openai');
const config = require('../config');

let client;

function getClient() {
  if (!client && config.llm.apiKey) {
    client = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseURL,
    });
  }
  return client;
}

async function callLLM(prompt) {
  try {
    const llmClient = getClient();
    if (!llmClient) {
      return 'AI 功能未配置，请设置 LLM_API_KEY 环境变量';
    }
    const resp = await llmClient.chat.completions.create({
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
    const llmClient = getClient();
    if (!llmClient) return null;
    const resp = await llmClient.chat.completions.create({
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

async function getHistoricalExamData() {
  return {
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    national: [975, 1031, 1071, 1078, 1193, 1291, 1342, 1400],
    provinces: [
      { name: '河南', data: [98.3, 100, 115.8, 125, 130, 131, 136, 142] },
      { name: '山东', data: [68, 72, 75.4, 79.5, 86.7, 88, 95, 100] },
      { name: '广东', data: [75.8, 76.8, 78.8, 78.3, 85.7, 90, 96, 102] },
      { name: '四川', data: [62, 65, 67, 69.8, 77, 80, 85, 88] },
      { name: '河北', data: [55.96, 56.6, 62.48, 63.4, 75.32, 83, 86, 90] },
      { name: '湖南', data: [45.1, 49.9, 53.7, 57.49, 65.5, 68, 73, 76] },
      { name: '安徽', data: [49.9, 51.3, 52.38, 54.2, 60.1, 64.7, 67, 70] },
      { name: '湖北', data: [37.4, 38.4, 39.48, 40.5, 46.5, 50.1, 53, 56] },
      { name: '江苏', data: [33, 33.9, 34.89, 35.9, 40.6, 44.5, 48, 51] },
      { name: '浙江', data: [30.6, 31.5, 32.51, 33.3, 36.4, 39.1, 42, 45] },
      { name: '广西', data: [40, 42, 46, 50.7, 55, 61, 64, 68] },
      { name: '贵州', data: [44, 45.8, 47, 46.1, 47.8, 49.1, 50.8, 53] },
      { name: '云南', data: [30, 32.6, 34.3, 35.8, 38.8, 39.9, 42, 44] },
      { name: '江西', data: [36, 37, 38.9, 40.5, 49.3, 53.6, 57, 60] },
      { name: '甘肃', data: [27.3, 26.6, 27.2, 24.6, 24.3, 24.8, 26, 27] },
      { name: '重庆', data: [25, 26.4, 28.3, 28.9, 31.4, 33.7, 35.5, 37] },
      { name: '黑龙江', data: [16.9, 17.8, 18.9, 19.4, 18.2, 19.1, 19.8, 20] },
      { name: '辽宁', data: [18.5, 19.1, 20.1, 19.1, 24.5, 18.8, 19.5, 20] },
      { name: '吉林', data: [15, 16.2, 15.5, 15.2, 12.5, 12.8, 13.2, 13.5] },
      { name: '陕西', data: [31.9, 32.6, 32.2, 31.3, 32.3, 33.7, 35, 36] },
      { name: '福建', data: [20, 20.7, 20.26, 20.1, 21.8, 23.2, 24.5, 26] },
      { name: '内蒙古', data: [19.5, 19.9, 19.8, 18.5, 18.5, 19.1, 20, 21] },
      { name: '新疆', data: [20.7, 22.1, 22.9, 22.9, 21.8, 22.7, 23.5, 24] },
      { name: '山西', data: [30, 31, 32.6, 31.6, 29.6, 31.6, 33, 34] },
      { name: '天津', data: [5.5, 5.6, 5.6, 5.6, 5.8, 6.9, 7.1, 7.3] },
      { name: '上海', data: [5, 5, 5, 5, 5.2, 5.4, 5.6, 5.8] },
      { name: '北京', data: [6.3, 5.9, 4.9, 5.2, 5.4, 5.8, 6.2, 6.5] },
      { name: '海南', data: [5.8, 5.9, 5.7, 5.9, 6.4, 7.3, 7.6, 7.9] },
      { name: '宁夏', data: [6.8, 7.2, 6.9, 6.2, 6.5, 7.2, 7.5, 7.8] },
      { name: '青海', data: [5, 5.3, 5.6, 4.8, 4.8, 5.1, 5.3, 5.5] },
      { name: '西藏', data: [2.8, 3.1, 3.3, 3.5, 3.2, 3.4, 3.6, 3.8] },
    ]
  };
}

module.exports = { callLLM, callLLMJson, buildPrompt, getIndustries, getSchoolMajorsByIndustry, getHistoricalExamData };
