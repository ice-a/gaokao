const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { marked } = require('marked');
const config = require('./config');

const app = express();

const viewsPath = path.join(process.cwd(), 'views');
app.set('view engine', 'ejs');
app.set('views', viewsPath);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), 'public')));

app.use((req, res, next) => {
  res.locals.md = (text) => {
    if (!text) return '';
    try {
      return marked.parse(text, { breaks: true, gfm: true });
    } catch (e) {
      return text;
    }
  };
  next();
});

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex').slice(0, 32);
}

const hashedPassword = hashPassword(config.auth.password);

app.use((req, res, next) => {
  try {
    if (req.path === '/login' || req.path === '/api/login') return next();
    if (req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/favicon')) return next();

    const token = req.cookies?.[config.auth.cookieName];
    if (token === hashedPassword) return next();

    if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: '请先登录' });
    }

    return res.render('login', { error: null });
  } catch (e) {
    console.error('Auth middleware error:', e);
    return res.status(500).send('服务器错误');
  }
});

app.get('/login', (req, res) => {
  try {
    res.render('login', { error: null });
  } catch (e) {
    console.error('Login page error:', e);
    res.status(500).send('服务器错误');
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
    res.status(500).send('服务器错误');
  }
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
  try {
    res.status(404).render('404');
  } catch (e) {
    res.status(404).send('页面未找到');
  }
});

app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).send('服务器错误');
});

module.exports = app;

if (!process.env.VERCEL) {
  const port = config.server.port;
  app.listen(port, () => {
    console.log(`服务已启动: http://localhost:${port}`);
  });
}
