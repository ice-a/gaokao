const express = require('express');
const router = express.Router();
const { getStats, getProvinces, getDepartmentStats } = require('../services/db');

router.get('/', async (req, res) => {
  const stats = await getStats();
  const provinces = await getProvinces();
  const departments = await getDepartmentStats();
  res.render('stats', { stats, provinces, departments });
});

module.exports = router;
