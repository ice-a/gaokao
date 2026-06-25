const express = require('express');
const router = express.Router();
const { getStats, getProvinces, getDepartmentStats } = require('../services/db');
const { getHistoricalExamData } = require('../services/llm');

router.get('/', async (req, res) => {
  try {
    const [stats, provinces, departments, examData] = await Promise.all([
      getStats(),
      getProvinces(),
      getDepartmentStats(),
      Promise.resolve(getHistoricalExamData()),
    ]);
    res.render('stats', { stats, provinces, departments, examData });
  } catch (e) {
    console.error('统计页错误:', e);
    res.status(500).send('加载失败: ' + e.message);
  }
});

module.exports = router;
