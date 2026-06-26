const express = require('express');
const router = express.Router();
const { marked } = require('marked');
const { listSchools, getSchoolDetail, getProvinces, getTags, getDepartments, getLevels, getScoreRange, getSchools } = require('../services/db');
const { callLLM, getIndustries, getSchoolMajorsByIndustry } = require('../services/llm');

router.get('/', async (req, res) => {
  try {
    const { province, tag, keyword, department, level, scoreMin, scoreMax, satisfaction, sort, industry, page } = req.query;
    const [provinces, tags, departments, levels, scoreRange, industries] = await Promise.all([
      getProvinces(), getTags(), getDepartments(), getLevels(), getScoreRange(), getIndustries(),
    ]);

    let result = await listSchools({
      province, tag, keyword, department, level,
      scoreMin, scoreMax, satisfaction, sort,
      page: parseInt(page) || 1,
    });

    const selectedIndustry = industries.find(i => i.id === industry);

    res.render('schools', {
      ...result, provinces, tags, departments, levels, scoreRange, industries,
      query: { province, tag, keyword, department, level, scoreMin, scoreMax, satisfaction, sort, industry },
      selectedIndustry,
    });
  } catch (e) {
    console.error('高校库错误:', e);
    res.status(503).render('error', { message: '数据库加载失败: ' + e.message, path: '/schools' });
  }
});

router.get('/:schId', async (req, res) => {
  try {
    const school = await getSchoolDetail(req.params.schId);
    if (!school) return res.status(404).render('404');
    const industries = await getIndustries();
    res.render('detail', { school, industries });
  } catch (e) {
    console.error('详情页错误:', e);
    res.status(503).render('error', { message: '加载失败: ' + e.message, path: '/schools' });
  }
});

router.post('/:schId/fetch-info', async (req, res) => {
  try {
    const school = await getSchoolDetail(req.params.schId);
    if (!school) return res.status(404).json({ error: '学校不存在' });

    const prompt = `请搜索并提供 ${school.name}（${school.province}，${school.department}）最新的招生信息。

请使用 Markdown 格式输出，包含以下内容：

## 2025年招生计划
各省份招生人数、招生专业，用表格展示。

## 2024年录取分数线
各省各批次最低录取分数线，用表格展示。

## 热门专业分数线
计算机、电子信息、医学、法学等热门专业的录取分数。

## 招生政策变化
今年招生政策有何变化。

## 就业数据
近年毕业生就业率、深造率、主要就业方向。

请尽量提供具体数据。如果某些数据无法确认请标注"待确认"。`;

    const analysis = await callLLM(prompt);
    const html = marked.parse(analysis, { breaks: true, gfm: true });

    const schools = await getSchools();
    await schools.updateOne(
      { sch_id: String(req.params.schId) },
      { $set: { latest_info: { content: analysis, fetched_at: new Date() } } }
    );

    res.json({ success: true, content: analysis, html });
  } catch (e) {
    console.error('获取信息错误:', e);
    res.json({ success: false, error: e.message });
  }
});

router.post('/:schId/industry-majors', async (req, res) => {
  try {
    const school = await getSchoolDetail(req.params.schId);
    if (!school) return res.status(404).json({ error: '学校不存在' });

    const { industryId } = req.body;
    const industries = await getIndustries();
    const industry = industries.find(i => i.id === industryId);
    if (!industry) return res.status(400).json({ error: '行业不存在' });

    const result = await getSchoolMajorsByIndustry(school.name, industry.name, industry.majors);
    if (result) {
      const schools = await getSchools();
      await schools.updateOne(
        { sch_id: String(req.params.schId) },
        { $set: { [`industry_majors.${industryId}`]: { data: result.majors, fetched_at: new Date() } } }
      );
      res.json({ success: true, data: result.majors });
    } else {
      res.json({ success: false, error: '获取数据失败' });
    }
  } catch (e) {
    console.error('行业专业错误:', e);
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
