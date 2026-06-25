const express = require('express');
const router = express.Router();
const { getStats, getProvinces, getDepartmentStats } = require('../services/db');

router.get('/', async (req, res) => {
  try {
    const stats = await getStats();
    const provinces = await getProvinces();
    const departments = await getDepartmentStats();
    res.render('stats', { stats, provinces, departments });
  } catch (e) {
    console.error('统计页错误:', e);
    res.status(500).render('404');
  }
});

module.exports = router;
