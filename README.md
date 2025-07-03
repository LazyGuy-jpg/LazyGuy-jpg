---

# 👋 Hello, I'm **@Ostrava**

Welcome, this is my area in the World Wide Web! A lazy developer myself, I prefer creating something that is not too complicated yet works like magic! Despite that, I always deliver quality! So, no complaints there!

---

## 👀 Interests

- 🖥 **Programming**: Loves Python, Node.js, and Asterisk.

- 🌐 **Telco & Automation**: Working on Asterisk and custom IVR systems.

- 🎲 **Creative Construction**: Being a part of any project, right from debugging to feature addition, is my goal.

---

## 🌱 Currently Learning

- 🔧 Trying my hands on **GoLang** for developing performance-centric applications.

---

## 📫 Get in Touch

- 📨 Telegram: [@ostdev]

--- 

## ⚡ Fun Fact

- I am a **lazy coder**, but **the highest outputs** are the things that I execute worth. Quality, always comes before quantity! 😎

Please connect with me or go through my projects. In case you think it's worth, do not miss to ⭐ my repos!

--- 

Thanks for sharing your opinion with me! What do you think? 😌

## Front-end (React)

The React codebase lives in the project root and is powered by [Vite](https://vitejs.dev/).

```bash
# Run dev server with hot-reload on http://localhost:5173
npm run dev

# Create an optimised production build under ./build
npm run build
```

The build artefacts under `build/` are what you should serve through **nginx**. The sample
nginx site configuration might look like:

```nginx
server {
    listen 80;
    server_name flowvoip.dev;

    root /root/app/build;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}

server {
    listen 80;
    server_name api.flowvoip.dev;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Back-end (Node.js)

The back-end code resides under `./server`.

```bash
cd server
npm i # install dependencies
npm run start  # or npm run dev
```

The API listens on `http://localhost:3000/v2/*` by default and should be reverse-proxied
by nginx under `https://api.flowvoip.dev/v2/*` as shown above.

---

### Env Variables

Both projects make use of env variables. Refer to `config.js` as well as the
`.env.example` files that live next to each `package.json` for a full list.

---

Happy hacking!

