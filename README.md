# Taskboard

A personal task dashboard with a dark, sleek look. It works on phone and desktop, and keeps the same tasks in every browser by syncing through a private GitHub repository that you own.

- **Dashboard** with panels you can rearrange:
  - **Today's focus** answers "what should I do now?". It shows one large **Up next** task with **Start** and **Done** buttons, then everything overdue, due today or starred.
  - A **daily-goal ring** fills as you finish tasks.
  - **Move all to today** reschedules every overdue task in one go, with Undo.
  - **At a glance** shows the key numbers, and **Your lists** has a card for each list.
  - Click **Customise** to drag panels into a new order or hide them. The layout is saved on that device.
- **Star ☆ any task** to pin it to Today's focus until it's done, like a "My Day" list.
- **Lists:** group tasks into lists such as Work, Personal or a project. Each list has its own emoji and colour.
- **List or Board view:** a plain list, or a Kanban board (To do / In progress / Done) that you drag cards across. On a phone, press and hold a card to drag it.
- **Quick date menu:** hover over a task and click the calendar icon for Today, Tomorrow, This weekend, Next week or any date.
- **Today and Upcoming:** what's overdue, due today, tomorrow, this week and later.
- **Priorities, tags and due dates,** with filters in each list.
- **Quick add:** type `Book dentist +Personal #health !high @friday`. Chips under the box show what it understood (list, date, priority, tags) before you press Enter.
- **Search** across tasks, notes, tags and lists.
- **Works offline** and can be installed on your phone's home screen.
- **Backup:** export and import your tasks as a file (Settings), and **import from Google Tasks**.

It's plain HTML, CSS and JavaScript, so there is no build step. GitHub Pages serves the files as they are.

---

## 1. Run it on your computer (optional)

To try changes locally, open a terminal in this folder and run:

```
python -m http.server 8000
```

Then open <http://localhost:8000> and sign in with your access token (see below).

## 2. Sign in (your tasks are stored in GitHub)

Opening Taskboard asks you to **sign in with your GitHub access token**. Your tasks are saved as one file, `taskboard.json`, in a **private** GitHub repository that only you can see, and every device you sign in on (phone, laptop, work computer) reads and writes that file, so they all show the same tasks. Each change is a commit, so GitHub also keeps a full history you can restore from.

Syncing is automatic: your changes upload within a couple of seconds, and changes from your other devices appear within about 30 seconds, or straight away when you switch back to the app. Each device also keeps a copy, so the app opens instantly and keeps working offline.

### One-time setup (about 2 minutes)

1. **Create a private repository for your data** at <https://github.com/new>. Name it `task-dashboard-data`, choose **Private**, then click **Create repository**. This is separate from the public repository that hosts the website.
2. **Create an access token** at <https://github.com/settings/personal-access-tokens/new> (Fine-grained tokens):
   - **Token name:** `Taskboard`.
   - **Expiration:** as long as you're comfortable with. When it expires, the app asks you to sign in again with a new token (changes on your device are kept).
   - **Repository access:** **Only select repositories**, then pick `task-dashboard-data`.
   - **Permissions → Repository permissions → Contents:** **Read and write**. Metadata (read-only) is added automatically.
   - Click **Generate token** and copy it (it starts with `github_pat_`).
3. **Sign in:** open the app, paste the token, keep the repository name `task-dashboard-data`, and click **Sign in**. You stay signed in on that device. If the browser already had tasks from before sign-in was required, you can bring them along.

### Add your phone (or any other browser)

On a signed-in computer, go to **Settings → Account & sync → Add another device**. Scan the QR code with your phone's camera and tap **Sign in**. You can also copy the setup link and open it on the other device. This works from your GitHub Pages site, not from `localhost`.

### Good to know

- **Security:** the token is stored only on the devices you sign in on, never in any repository, and it can only reach `task-dashboard-data`. The website itself holds no tasks; without the token there's nothing to see. The QR code and setup link contain the token, so only scan them on your own devices. If a device is lost, delete the token on GitHub, create a new one, and sign in again.
- **Sign out** (**Settings → Account & sync**) makes a device forget the token and its copy of your tasks. Your tasks stay safe in GitHub.
- **When two devices change the same task** before syncing, the most recent change wins. Changes to different tasks are always combined.
- **History:** open the repository on GitHub and click **History** on `taskboard.json` to see or restore earlier versions.

## Bring over your Google Tasks

1. Open [Google Takeout](https://takeout.google.com/settings/takeout/custom/tasks). Tick only **Tasks**, click **Next step**, then **Create export**. Google emails a download link, usually within minutes.
2. In Taskboard, go to **Settings → Backup → Import from Google Tasks** and choose the downloaded **.zip** (or the `Tasks.json` inside it).
3. Check the preview, then click **Import**.

- Each Google Tasks list becomes a Taskboard list. Titles, notes, links, due dates and completed status come over. Subtasks become normal tasks, noted with their parent.
- The file is read in your browser and isn't uploaded anywhere. Once imported, your tasks sync through GitHub like any others.
- You can import a newer export later: only new tasks are added, and anything you've changed in Taskboard is left alone.

## 3. Publish on GitHub Pages

1. Push this folder to a **public** GitHub repository, for example `task-dashboard`. It contains only the app, never your tasks or token.
2. In the repo, go to **Settings → Pages → Build and deployment**. Set **Source** to **Deploy from a branch** and **Branch** to **`main`** with **`/ (root)`**, then click **Save**.
3. After about a minute your app is live at `https://YOUR-GITHUB-USERNAME.github.io/task-dashboard/`.

### Put it on your phone

- **iPhone (Safari):** tap **Share → Add to Home Screen**.
- **Android (Chrome):** tap the **⋮** menu **→ Install app** (or **Add to Home screen**).

## Updating the app

Edit the files, then commit and push. GitHub Pages redeploys within about a minute, and the app picks up the new version the next time it's opened.

## Tips

| Type in quick add | What it does |
| --- | --- |
| `+List` | Puts the task in that list (the start of the name is enough, e.g. `+pers`) |
| `#tag` | Adds a tag |
| `!high`, `!med`, `!low` | Sets the priority |
| `@today`, `@tomorrow`, `@fri`, `@nextweek`, `@2026-12-01` | Sets the due date |

| Shortcut (desktop) | |
| --- | --- |
| `N` | New task |
| `/` or `Ctrl K` | Search |
| `Ctrl Enter` | Save the task you're editing |
| `Esc` | Close |

- **Daily goal:** the ring in Today's focus counts tasks finished today. The default is 5; change it in **Settings → Daily goal**.
- **Adding from Today's focus:** tasks you add there are starred for today automatically, unless you give them a later `@date`.
- **Backups:** besides GitHub's history, **Settings → Export** downloads all your tasks as a file, and **Import** brings them back.

## How it's built

```
index.html               app shell
css/styles.css           all styling (colours are CSS variables; light theme included)
js/app.js                start-up, routing, layout
js/store.js              app data and actions (the only module views talk to)
js/backend/github.js     GitHub sync: local-first cache + merge + read/write taskboard.json
js/views/                dashboard (panels), focus (Today's focus), list (list/board), today/upcoming
js/components/           task cards, editors, quick-add, date menu, sign-in, search, settings, toasts, icons
sw.js                    offline support
```

Tasks and lists are stored in `taskboard.json` in your private data repository. Each record carries an `updatedAt` time, and deletions are kept for 30 days so they reach your other devices.
