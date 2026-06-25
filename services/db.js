const { MongoClient } = require('mongodb');
const config = require('../config');

let client;
let db;
let schools;

async function getClient() {
  if (!client) {
    client = new MongoClient(config.mongo.uri, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    await client.connect();
    db = client.db(config.mongo.db);
    schools = db.collection(config.mongo.collection);
  }
  return { client, db, schools };
}

async function getSchools() {
  const { schools } = await getClient();
  return schools;
}

async function queryByScore(score, province, subject, level) {
  const { schools } = await getClient();
  const pipeline = [
    { $match: { level } },
    { $unwind: '$llm_data.admission_scores' },
    {
      $match: {
        'llm_data.admission_scores.min_score': {
          $gte: score - 80,
          $lte: score + 50,
        },
      },
    },
    {
      $group: {
        _id: '$_id',
        name: { $first: '$name' },
        province: { $first: '$province' },
        department: { $first: '$department' },
        level: { $first: '$level' },
        tags: { $first: '$tags' },
        satisfaction: { $first: '$satisfaction' },
        detail_url: { $first: '$detail_url' },
        scores: { $push: '$llm_data.admission_scores' },
      },
    },
    { $sort: { name: 1 } },
  ];

  const results = await schools.aggregate(pipeline).toArray();
  const categorized = { rush: [], stable: [], safe: [] };

  for (const r of results) {
    const minScores = r.scores.map((s) => s.min_score).filter((s) => s != null);
    if (!minScores.length) continue;
    const avgMin = Math.round(minScores.reduce((a, b) => a + b, 0) / minScores.length);
    const diff = score - avgMin;
    const school = {
      name: r.name, province: r.province, department: r.department,
      tags: r.tags || [], satisfaction: r.satisfaction, detail_url: r.detail_url,
      sch_id: r._id?.toString(), avg_min_score: avgMin, scores: r.scores.slice(-5), diff,
    };
    if (diff >= 30) categorized.safe.push(school);
    else if (diff >= -10) categorized.stable.push(school);
    else if (diff >= -50) categorized.rush.push(school);
  }

  for (const k of Object.keys(categorized)) {
    categorized[k].sort((a, b) => b.avg_min_score - a.avg_min_score);
  }
  return categorized;
}

async function listSchools({ province, tag, keyword, department, level, scoreMin, scoreMax, satisfaction, sort, page = 1, pageSize = 20 }) {
  const { schools } = await getClient();
  const filter = {};
  if (province) filter.province = province;
  if (tag) filter.tags = tag;
  if (keyword) filter.name = { $regex: keyword, $options: 'i' };
  if (department) filter.department = department;
  if (level) filter.level = level;
  if (satisfaction) filter.satisfaction = { $gte: parseFloat(satisfaction) };

  if (scoreMin || scoreMax) {
    const scoreFilter = {};
    if (scoreMin) scoreFilter.$gte = parseInt(scoreMin);
    if (scoreMax) scoreFilter.$lte = parseInt(scoreMax);
    filter['llm_data.admission_scores'] = {
      $elemMatch: { min_score: scoreFilter },
    };
  }

  const sortOption = {};
  if (sort === 'score_desc') sortOption['llm_data.admission_scores.min_score'] = -1;
  else if (sort === 'satisfaction') sortOption.satisfaction = -1;
  else sortOption.name = 1;

  const total = await schools.countDocuments(filter);
  const list = await schools
    .find(filter)
    .sort(sortOption)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();

  return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

async function getSchoolDetail(schId) {
  const { schools } = await getClient();
  return schools.findOne({ sch_id: String(schId) });
}

async function getProvinces() {
  const { schools } = await getClient();
  return schools.aggregate([
    { $group: { _id: '$province', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
}

async function getTags() {
  const { schools } = await getClient();
  return schools.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
}

async function getDepartments() {
  const { schools } = await getClient();
  return schools.aggregate([
    { $group: { _id: '$department', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
}

async function getLevels() {
  const { schools } = await getClient();
  return schools.aggregate([
    { $group: { _id: '$level', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
}

async function getScoreRange() {
  const { schools } = await getClient();
  const result = await schools.aggregate([
    { $unwind: '$llm_data.admission_scores' },
    {
      $group: {
        _id: null,
        min: { $min: '$llm_data.admission_scores.min_score' },
        max: { $max: '$llm_data.admission_scores.min_score' },
      },
    },
  ]).toArray();
  return result[0] || { min: 0, max: 750 };
}

async function getStats() {
  const { schools } = await getClient();
  const total = await schools.countDocuments({});
  const provinces = await schools.distinct('province');
  const tags = await schools.distinct('tags');
  const withScores = await schools.countDocuments({ 'llm_data.admission_scores.0': { $exists: true } });
  return { total, provinces: provinces.length, tags: tags.length, withScores };
}

async function getDepartmentStats() {
  const { schools } = await getClient();
  return schools.aggregate([
    { $group: { _id: '$department', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]).toArray();
}

async function compareSchools(ids) {
  const { schools } = await getClient();
  return schools.find({ sch_id: { $in: ids.map(String) } }).toArray();
}

module.exports = {
  getSchools, queryByScore, listSchools,
  getSchoolDetail, getProvinces, getTags, getStats,
  getDepartmentStats, compareSchools, getDepartments, getLevels, getScoreRange,
};
