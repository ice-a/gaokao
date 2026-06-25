const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const config = require('./config');

let marked;
try {
  marked = require('marked').marked;
} catch (e) {
  console.error('marked import error:', e);
  marked = (text) => text;
}

const app = express();

const viewsPath = path.join(process.cwd(), 'views');
console.log('Views path:', viewsPath);
console.log('CWD:', process.cwd());

app.set('view engine', 'ejs');
app.set('views', viewsPath);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const publicPath = path.join(process.cwd(), 'public');
console.log('Public path:', publicPath);
app.use(express.static(publicPath));

app.use((req, res, next) => {
  res.locals.md = (text) => {
    if (!text) return '';
    try {
      return marked(text, { breaks: true, gfm: true });
    } catch (e) {
      console.error('Markdown parse error:', e);
      return text;
    }
  };
  next();
});

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex').slice(0, 32);
}

const hashedPassword = hashPassword(config.auth.password);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.VERCEL ? 'vercel' : 'local' });
});

app.use((req, res, next) => {
  try {
    if (req.path === '/login' || req.path === '/api/login' || req.path === '/api/health') return next();
    if (req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/favicon')) return next();

    const token = req.cookies?.[config.auth.cookieName];
    if (token === hashedPassword) return next();

    if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: '请先登录' });
    }

    return res.render('login', { error: null });
  } catch (e) {
    console.error('Auth middleware error:', e);
    return res.status(500).send('服务器错误: ' + e.message);
  }
});

app.get('/login', (req, res) => {
  try {
    res.render('login', { error: null });
  } catch (e) {
    console.error('Login page error:', e);
    res.status(500).send('登录页错误: ' + e.message);
  }
});

app.post('/login', (req, res) => {
  try {
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
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).send('登录错误: ' + e.message);
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie(config.auth.cookieName);
  res.redirect('/login');
});

try {
  app.use('/', require('./routes/index'));
  app.use('/schools', require('./routes/schools'));
  app.use('/stats', require('./routes/stats'));
  app.use('/compare', require('./routes/compare'));
} catch (e) {
  console.error('Routes loading error:', e);
}

app.use((req, res) => {
  try {
    res.status(404).render('404');
  } catch (e) {
    res.status(404).send('页面未找到');
  }
});

app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).send('服务器错误: ' + err.message);
});

module.exports = app;

if (!process.env.VERCEL) {
  const port = config.server.port;
  app.listen(port, () => {
    console.log(`服务已启动: http://localhost:${port}`);
  });
}
