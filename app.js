const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { marked } = require('marked');
const { connect } = require('./services/db');
const config = require('./config');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.locals.md = (text) => {
    if (!text) return '';
    return marked.parse(text, { breaks: true, gfm: true });
  };
  next();
});

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex').slice(0, 32);
}

const hashedPassword = hashPassword(config.auth.password);

app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/api/login') return next();
  if (req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/favicon')) return next();

  const token = req.cookies?.[config.auth.cookieName];
  if (token === hashedPassword) return next();

  if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: '请先登录' });
  }

  return res.render('login', { error: null });
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === config.auth.password) {
    res.cookie(config.auth.cookieName, hashedPassword, {
      maxAge: config.auth.cookieMaxAge,
      httpOnly: true,
      sameSite: 'lax',
    });
    return res.redirect('/');
  }
  res.render('login', { error: '密码错误，请重试' });
});

app.get('/logout', (req, res) => {
  res.clearCookie(config.auth.cookieName);
  res.redirect('/login');
});

app.use('/', require('./routes/index'));
app.use('/schools', require('./routes/schools'));
app.use('/stats', require('./routes/stats'));
app.use('/compare', require('./routes/compare'));

app.use((req, res) => {
  res.status(404).render('404');
});

async function start() {
  await connect();
  app.listen(config.server.port, () => {
    console.log(`服务已启动: http://localhost:${config.server.port}`);
  });
}

start().catch(console.error);
