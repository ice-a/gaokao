const express = require('express');
const router = express.Router();
const { queryByScore } = require('../services/db');
const { callLLM, buildPrompt, getIndustries } = require('../services/llm');

const PROVINCES = [
  '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南',
  '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州',
  '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
];

router.get('/', async (req, res) => {
  const industries = await getIndustries();
  res.render('index', { provinces: PROVINCES, industries, error: null });
});

router.post('/analyze', async (req, res) => {
  const { score, province, subject, level, industry, preference } = req.body;
  const numScore = parseInt(score);
  const industries = await getIndustries();

  if (!numScore || !province) {
    return res.render('index', { provinces: PROVINCES, industries, error: '请填写分数和省份' });
  }

  try {
    const schools = await queryByScore(numScore, province, subject || '理科', level || '本科');

    const total = schools.rush.length + schools.stable.length + schools.safe.length;
    if (total === 0) {
      return res.render('index', { provinces: PROVINCES, industries, error: '未找到匹配的学校，请调整分数或条件' });
    }

    const selectedIndustry = industries.find(i => i.id === industry);
    let fullPreference = preference || '';
    if (selectedIndustry) {
      fullPreference = `意向行业：${selectedIndustry.name}，关注专业：${selectedIndustry.majors.join('、')}`;
      if (preference) fullPreference += `，其他偏好：${preference}`;
    }

    let prompt = buildPrompt(numScore, province, subject || '理科', schools);
    if (fullPreference) prompt += `\n考生偏好：${fullPreference}`;

    const aiAnalysis = await callLLM(prompt);

    res.render('result', {
      score: numScore,
      province,
      subject: subject || '理科',
      level: level || '本科',
      industry: selectedIndustry || null,
      preference,
      schools,
      aiAnalysis,
    });
  } catch (e) {
    console.error('分析失败:', e);
    res.render('index', { provinces: PROVINCES, industries, error: '分析失败，请稍后重试' });
  }
});

module.exports = router;
