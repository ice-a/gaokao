const express = require('express');
const router = express.Router();
const { compareSchools, getSchools } = require('../services/db');
const { callLLM } = require('../services/llm');

router.get('/', (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : [];
  res.render('compare', { schools: [], ids });
});

router.get('/search', async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    if (!keyword) return res.json([]);
    const schools = await getSchools();
    const results = await schools
      .find({ name: { $regex: keyword, $options: 'i' } })
      .project({ sch_id: 1, name: 1, province: 1 })
      .limit(10)
      .toArray();
    res.json(results);
  } catch (e) {
    console.error('搜索错误:', e);
    res.json([]);
  }
});

router.post('/', async (req, res) => {
  try {
    const ids = req.body.ids || [];
    if (ids.length < 2) {
      return res.render('compare', { schools: [], ids, error: '请至少选择两所学校' });
    }
    const schools = await compareSchools(ids);
    res.render('compare', { schools, ids });
  } catch (e) {
    console.error('对比错误:', e);
    res.status(500).render('404');
  }
});

router.post('/ai', async (req, res) => {
  try {
    const ids = req.body.ids || [];
    const schools = await compareSchools(ids);
    if (schools.length < 2) return res.json({ error: '数据不足' });

    const info = schools.map(s => {
      const scores = (s.llm_data?.admission_scores || []).slice(-3)
        .map(sc => `${sc.year}年${sc.batch}最低${sc.min_score}分`).join('、');
      return `${s.name}（${s.province}，${s.department}，${s.tags?.join('/') || '无特色'}）近年录取：${scores || '暂无'}`;
    }).join('\n');

    const prompt = `请对比分析以下高校，从综合实力、优势学科、就业前景、录取难度、城市环境等维度给出详细对比和建议：\n\n${info}`;
    const analysis = await callLLM(prompt);
    res.json({ analysis });
  } catch (e) {
    console.error('AI对比错误:', e);
    res.json({ error: e.message });
  }
});

module.exports = router;
