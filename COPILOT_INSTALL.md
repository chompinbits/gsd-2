**Run directly from the build output**
```bash
cd /home/hornc/repos/gsd-2
npm ci
npm run build
node dist/loader.js
```

**Expose this local checkout as `gsd`**
```bash
cd /home/hornc/repos/gsd-2
npm ci
npm run build
npm link
which gsd
gsd
```

**Install the local checkout globally**
```bash
cd /home/hornc/repos/gsd-2
npm ci
npm run build
npm install -g .
which gsd
gsd
```

If `npm link` or `npm install -g .` succeeds but `which gsd` is still empty, your global npm bin dir is not on `PATH`. The repo’s troubleshooting doc calls that out in troubleshooting.md.

Check it with:
```bash
npm prefix -g
echo "$PATH"
ls "$(npm prefix -g)/bin/gsd"
```

If needed, add it:
```bash
echo 'export PATH="$(npm prefix -g)/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

So the short version is:

- `npm run pi:install-global` = install Pi resources
- `npm link` or `npm install -g .` = install the `gsd` command from this checkout
- `node dist/loader.js` = run it without installing anything globally

To uninstall or unlink the GSD CLI:

**If you used `npm link`:**
```bash
cd /home/hornc/repos/gsd-2
npm unlink
```

**If you used `npm install -g .`:**
```bash
npm uninstall -g gsd-pi
```

**If you used `npm install -g` on NPM registry:**
```bash
npm uninstall -g gsd-pi
```

To remove Pi resources (extensions/skills/agents):
```bash
cd /home/hornc/repos/gsd-2
npm run pi:uninstall-global
```

This removes GSD resources from `~/.pi` but leaves your shell profile intact.

To verify it's gone:
```bash
which gsd
```

Should return nothing.